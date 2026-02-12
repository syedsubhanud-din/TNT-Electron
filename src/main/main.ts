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

ipcMain.handle('run-python', async (_event, scriptName, args) => {
  return new Promise((resolve, reject) => {
    const pythonDir = app.isPackaged
      ? path.join(process.resourcesPath, 'python')
      : path.join(__dirname, '../../python');

    const scriptPath = path.join(pythonDir, scriptName);

    // On Windows, 'python' often points to the Microsoft Store installer alias.
    // 'py' is the Python Launcher for Windows and is more reliable if installed.
    const pythonExecutable = process.platform === 'win32'
      ? path.join(process.env.LOCALAPPDATA || '', 'Programs\\Python\\Launcher\\py.exe') || 'py'
      : 'python3';

    // Fallback to just 'py' if the full path check failed or if just relying on PATH is preferred
    const finalExecutable = process.platform === 'win32' && !pythonExecutable.includes('\\') ? 'py' : pythonExecutable;

    // Use full path if available for robustness as requested
    // If not, just use 'py' which relies on PATH
    
    // Note: For production use on client machines without 'py', you may need to bundle Python
    // or allow configuration of the python path. 
    // Here we try to use the launcher which is standard on modern Windows python installs.

    console.log(`Executing with: ${finalExecutable} ${scriptPath} ${args.join(' ')}`);

    execFile(finalExecutable, [scriptPath, ...args], (error: Error | null, stdout: string, stderr: string) => {
      if (error) {
        console.error(`execFile error: ${error}`);
        reject(error);
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
  return new Promise((resolve, reject) => {
    const pythonDir = app.isPackaged
      ? path.join(process.resourcesPath, 'python')
      : path.join(__dirname, '../../python');

    const scriptPath = path.join(pythonDir, 'print_label.py');

    const pythonExecutable = process.platform === 'win32' ? 'py' : 'python3';

    const args = [scriptPath, action, data];

    console.log(`Executing: ${pythonExecutable} ${args.join(' ')}`);

    execFile(pythonExecutable, args, { maxBuffer: 1024 * 1024 }, (error: Error | null, stdout: string, stderr: string) => {
      if (error) {
        console.error(`execFile error: ${error}`);
        console.error(`stderr: ${stderr}`);
        resolve({ success: false, error: error.message });
        return;
      }
      if (stderr) {
        console.warn(`stderr: ${stderr}`);
      }
      console.log(`stdout: ${stdout}`);
      
      try {
        // Try to parse the last line as JSON (the result)
        const lines = stdout.trim().split('\n');
        const lastLine = lines[lines.length - 1];
        const result = JSON.parse(lastLine);
        resolve(result);
      } catch (parseError) {
        console.error('Failed to parse Python output:', parseError);
        resolve({ success: false, error: 'Failed to parse Python output', output: stdout });
      }
    });
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
  .then(() => {
    createWindow();
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) createWindow();
    });
  })
  .catch(console.log);
