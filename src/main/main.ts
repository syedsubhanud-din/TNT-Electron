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
import { execFile } from 'child_process';
import log from 'electron-log';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';

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
  const venvPython = process.platform === 'win32'
    ? path.join(pythonDir, 'venv', 'Scripts', 'python.exe')
    : path.join(pythonDir, 'venv', 'bin', 'python');

  const fs = require('fs');
  
  // If venv exists, we try it first. 
  // But in packaged builds, a local venv might be broken due to absolute paths in pyvenv.cfg.
  if (fs.existsSync(venvPython)) {
    // Basic check: if we're packaged, the venv might be invalid if it was copied from a different user's machine
    // However, some users might bundle a truly portable venv.
    // We'll tentatively use it, but we need a way to fallback if it fails.
    return venvPython;
  }

  // Fallback to system python
  if (process.platform === 'win32') {
    // Try 'python' first, then 'py' (launcher)
    return 'python'; 
  }
  return 'python3';
};

ipcMain.handle('run-python', async (_event, scriptName, args) => {
  const pythonDir = app.isPackaged
    ? path.join(process.resourcesPath, 'python')
    : path.join(__dirname, '../../python');

  const pythonExecutable = await getPythonExecutable(pythonDir);
  const scriptPath = path.join(pythonDir, scriptName);

  return new Promise((resolve, reject) => {
    console.log(`Executing: ${pythonExecutable} ${scriptPath} ${args.join(' ')}`);

    execFile(pythonExecutable, [scriptPath, ...args], (error: Error | null, stdout: string, stderr: string) => {
      if (error) {
        console.error(`execFile error: ${error}`);
        // If the primary executable failed, try one last fallback to 'py' on windows
        if (process.platform === 'win32' && pythonExecutable !== 'py') {
          console.log('Primary python failed, trying "py" launcher...');
          execFile('py', [scriptPath, ...args], (error2: Error | null, stdout2: string, stderr2: string) => {
            if (error2) {
              const errorMsg = stderr2 || stdout2 || error2.message;
              reject(new Error(errorMsg));
            } else {
              resolve(stdout2 || stderr2);
            }
          });
          return;
        }
        const errorMsg = stderr || stdout || error.message;
        reject(new Error(errorMsg));
        return;
      }
      if (stderr) {
        console.warn(`stderr: ${stderr}`);
      }
      console.log(`stdout: ${stdout}`);
      resolve(stdout || stderr);
    });
  });
});

ipcMain.handle('execute-python', async (_event, action, data) => {
  const pythonDir = app.isPackaged
    ? path.join(process.resourcesPath, 'python')
    : path.join(__dirname, '../../python');

  const pythonExecutable = await getPythonExecutable(pythonDir);
  const scriptPath = path.join(pythonDir, 'print_label.py');
  const args = [scriptPath, action, data];

  return new Promise((resolve, reject) => {
    console.log(`Executing: ${pythonExecutable} ${args.join(' ')}`);

    const options = { maxBuffer: 1024 * 1024 };
    
    const run = (exe: string) => {
      execFile(exe, args, options, (error: Error | null, stdout: string, stderr: string) => {
        if (error) {
          if (process.platform === 'win32' && exe !== 'py') {
            console.log('Primary python failed, trying "py" launcher...');
            run('py');
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
          resolve({ success: false, error: 'Failed to parse Python output', output: stdout });
        }
      });
    };

    run(pythonExecutable);
  });
});

ipcMain.handle('get-printer-config', async () => {
  const pythonDir = app.isPackaged
    ? path.join(process.resourcesPath, 'python')
    : path.join(__dirname, '../../python');
  const configPath = path.join(pythonDir, 'create_message', 'printer_config.json');
  const fs = require('fs');
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error reading printer config:', error);
  }
  return { printer_ip: '172.16.0.55', printer_port: 9944 };
});

ipcMain.handle('save-printer-config', async (_event, config) => {
  const pythonDir = app.isPackaged
    ? path.join(process.resourcesPath, 'python')
    : path.join(__dirname, '../../python');
  const configPath = path.join(pythonDir, 'create_message', 'printer_config.json');
  const fs = require('fs');
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    return { success: true };
  } catch (error: any) {
    console.error('Error saving printer config:', error);
    return { success: false, error: error.message };
  }
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
  .then(() => {
    createWindow();
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) createWindow();
    });
  })
  .catch(console.log);
