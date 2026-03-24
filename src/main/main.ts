/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import path from 'path';
import { app, BrowserWindow, shell, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import { execFile, spawn } from 'child_process';
import log from 'electron-log';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import { sequelize } from './database';
import { registerUserRoutes } from './database/routes/userRoutes/userRoutes';
import { registerTemplateRoutes } from './database/routes/templateRoutes/templateRoutes';
import { runSeed } from './database/seeders/initialSeed';

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;

ipcMain.on('ipc-example', async (event, arg) => {
  const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
  console.log(msgTemplate(arg));
  event.reply('ipc-example', msgTemplate('pong'));
});

const getPythonExecutable = async (pythonDir: string) => {
  const fs = require('fs');

  // When packaged, skip venv: it embeds the build machine's Python path (e.g. C:\...\Python313\python.exe)
  // which fails with "did not find executable" when the app is installed elsewhere.
  if (!app.isPackaged) {
    const venvPython =
      process.platform === 'win32'
        ? path.join(pythonDir, 'venv', 'Scripts', 'python.exe')
        : path.join(pythonDir, 'venv', 'bin', 'python');

    if (fs.existsSync(venvPython)) {
      return venvPython;
    }
  }

  // Fallback to system python (from PATH)
  if (process.platform === 'win32') {
    return 'python';
  }
  return 'python3';
};

/**
 * In packaged builds the Python scripts are compiled to standalone .exe files.
 * Returns the exe path if it exists, otherwise falls back to running the .py
 * script with the system Python interpreter.
 */
const resolveScript = async (
  pythonDir: string,
  scriptName: string,
): Promise<{ executable: string; scriptArgs: string[] }> => {
  const fs = require('fs');

  if (app.isPackaged) {
    // e.g. 'print_label.py' → 'print_label.exe'
    const exeName = scriptName.replace(/\.py$/, '.exe');
    const exePath = path.join(pythonDir, exeName);
    if (fs.existsSync(exePath)) {
      return { executable: exePath, scriptArgs: [] };
    }
  }

  // Dev mode (or exe not found): use Python interpreter + script path
  const pythonExecutable = await getPythonExecutable(pythonDir);
  const scriptPath = path.join(pythonDir, scriptName);
  return { executable: pythonExecutable, scriptArgs: [scriptPath] };
};

ipcMain.handle('run-python', async (_event, scriptName, args, options = {}) => {
  const pythonDir = app.isPackaged
    ? path.join(process.resourcesPath, 'python')
    : path.join(__dirname, '../../python');

  const { executable, scriptArgs } = await resolveScript(pythonDir, scriptName);
  const fullArgs = [...scriptArgs, ...args];

  if (options.background) {
    console.log(
      `Spawning background process: ${executable} ${fullArgs.join(' ')}`,
    );
    const os = require('os');
    const crypto = require('crypto');
    const stopFile =
      scriptName.includes('mv.py') || scriptName.includes('mv.exe')
        ? path.join(
            os.tmpdir(),
            `mv40_stop_${crypto.randomBytes(8).toString('hex')}`,
          )
        : null;
    const env = { ...process.env };
    if (stopFile) env.MV40_STOP_FILE = stopFile;
    const child = spawn(executable, fullArgs, { env });

    child.stdout.on('data', (data) => {
      const output = data.toString();
      const lines = output.split('\n');
      lines.forEach((line: string) => {
        if (!line.trim()) return;
        if (line.includes('Flushed')) return;

        if (line.includes('Scanned:')) {
          console.log(
            `\x1b[32m[Python PID ${child.pid}] stdout: ${line.trim()}\x1b[0m`,
          );
        } else {
          console.log(`[Python PID ${child.pid}] stdout: ${line.trim()}`);
        }
      });
      _event.sender.send('python-stdout', { pid: child.pid, data: output });
    });

    child.stderr.on('data', (data) => {
      const output = data.toString();
      const lines = output.split('\n');
      lines.forEach((line: string) => {
        if (!line.trim()) return;
        if (line.includes('Flushed')) return;

        if (line.includes('Scanned:')) {
          console.error(
            `\x1b[32m[Python PID ${child.pid}] stderr: ${line.trim()}\x1b[0m`,
          );
        } else {
          console.error(`[Python PID ${child.pid}] stderr: ${line.trim()}`);
        }
      });
      _event.sender.send('python-stderr', { pid: child.pid, data: output });
    });

    child.on('close', (code) => {
      console.log(`[Python PID ${child.pid}] process exited with code ${code}`);
      _event.sender.send('python-exit', { pid: child.pid, code });
    });

    return {
      success: true,
      pid: child.pid,
      ...(stopFile && { stopFile }),
    };
  }

  return new Promise((resolve, reject) => {
    console.log(`Executing: ${executable} ${fullArgs.join(' ')}`);

    const execOptions = {
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env },
    };

    execFile(
      executable,
      fullArgs,
      execOptions,
      (error: Error | null, stdout: string, stderr: string) => {
        if (error) {
          console.error(`execFile error: ${error}`);
          // Only try 'py' fallback in dev mode when using system python
          if (
            !app.isPackaged &&
            process.platform === 'win32' &&
            executable !== 'py'
          ) {
            console.log('Primary python failed, trying "py" launcher...');
            execFile(
              'py',
              fullArgs,
              execOptions,
              (error2: Error | null, stdout2: string, stderr2: string) => {
                if (error2) {
                  const errorMsg = stderr2 || stdout2 || error2.message;
                  reject(new Error(errorMsg));
                } else {
                  resolve(stdout2 || stderr2);
                }
              },
            );
            return;
          }
          const errorMsg = stderr || stdout || error.message;
          reject(new Error(errorMsg));
          return;
        }
        if (stderr) console.warn(`stderr: ${stderr}`);
        console.log(`stdout: ${stdout}`);
        resolve(stdout || stderr);
      },
    );
  });
});

ipcMain.handle('stop-python', async (_event, pid, stopFile?: string) => {
  if (pid) {
    try {
      // If stopFile provided (mv.py), signal graceful shutdown first
      if (stopFile) {
        const fs = require('fs');
        try {
          fs.writeFileSync(stopFile, '1', 'utf8');
        } catch {
          /* ignore */
        }
        // Wait for process to exit gracefully (OFFLINE sent, camera stops)
        await new Promise((r) => setTimeout(r, 2500));
      }
      if (process.platform === 'win32') {
        const { execSync } = require('child_process');
        execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
      } else {
        process.kill(pid);
      }
      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }
  return { success: false, error: 'No PID provided' };
});

ipcMain.handle('execute-python', async (_event, action, data) => {
  const pythonDir = app.isPackaged
    ? path.join(process.resourcesPath, 'python')
    : path.join(__dirname, '../../python');

  const { executable, scriptArgs } = await resolveScript(
    pythonDir,
    'print_label.py',
  );
  const fullArgs = [...scriptArgs, action, data];

  return new Promise((resolve) => {
    console.log(`Executing: ${executable} ${fullArgs.join(' ')}`);

    const options = { maxBuffer: 1024 * 1024 };

    const run = (exe: string, exeArgs: string[]) => {
      execFile(
        exe,
        exeArgs,
        options,
        (error: Error | null, stdout: string, stderr: string) => {
          if (error) {
            // In dev mode only, try 'py' launcher as fallback
            if (
              !app.isPackaged &&
              process.platform === 'win32' &&
              exe !== 'py'
            ) {
              console.log('Primary python failed, trying "py" launcher...');
              run('py', exeArgs);
              return;
            }
            console.error(`execFile error: ${error}`);
            resolve({ success: false, error: error.message });
            return;
          }

          try {
            const lines = stdout.trim().split('\n');
            const lastLine = lines[lines.length - 1];
            const result = JSON.parse(lastLine);
            resolve(result);
          } catch (parseError) {
            console.error('Failed to parse Python output:', parseError);
            resolve({
              success: false,
              error: 'Failed to parse Python output',
              output: stdout,
            });
          }
        },
      );
    };

    run(executable, fullArgs);
  });
});

ipcMain.handle('get-printer-config', async () => {
  const pythonDir = app.isPackaged
    ? path.join(process.resourcesPath, 'python')
    : path.join(__dirname, '../../python');
  const configPath = path.join(
    pythonDir,
    'create_message',
    'printer_config.json',
  );
  const fs = require('fs');
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error reading printer config:', error);
  }
  return { printer_ip: '192.168.2.22', printer_port: 9944 };
});

ipcMain.handle('save-printer-config', async (_event, config) => {
  const pythonDir = app.isPackaged
    ? path.join(process.resourcesPath, 'python')
    : path.join(__dirname, '../../python');
  const configPath = path.join(
    pythonDir,
    'create_message',
    'printer_config.json',
  );
  const fs = require('fs');
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    return { success: true };
  } catch (error: any) {
    console.error('Error saving printer config:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('test-printer-connection', async (_event, config) => {
  const { printer_ip, printer_port } = config;
  const net = require('net');
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timeout = 3000;

    socket.setTimeout(timeout);

    socket.on('connect', () => {
      socket.end();
      resolve({ success: true });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({ success: false, error: 'Connection timed out' });
    });

    socket.on('error', (err: any) => {
      socket.destroy();
      resolve({ success: false, error: err.message });
    });

    socket.connect(printer_port, printer_ip);
  });
});

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDebug) {
  require('electron-debug').default();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload,
    )
    .catch(console.log);
};

const createWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  mainWindow = new BrowserWindow({
    show: false,
    width: 1024,
    height: 728,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
    },
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app
  .whenReady()
  .then(async () => {
    registerUserRoutes();
    registerTemplateRoutes();

    try {
      await sequelize.authenticate();
      console.log('✅ Database connected successfully.');

      await sequelize.sync({ alter: true });
      console.log('✅ Database models synchronized.');
      await runSeed();
    } catch (error: any) {
      console.error('❌ Database initialization failed:', error.message);
    }

    createWindow();
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) createWindow();
    });
  })
  .catch(console.log);
