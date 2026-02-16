import { ipcMain } from 'electron';
import UserController from '../../controllers/UserController/UserController';
import { authMiddleware, loggerMiddleware } from '../../middleware/ipcMiddleware';

export const registerUserRoutes = () => {
  // Public routes
  ipcMain.handle('login', loggerMiddleware(UserController.login));
  ipcMain.handle('logout', loggerMiddleware(UserController.logout));

  // Protected routes
  ipcMain.handle('get-users', authMiddleware(loggerMiddleware(UserController.getUsers)));
  ipcMain.handle('create-user', authMiddleware(loggerMiddleware(UserController.createUser)));
};
