import { ipcMain } from 'electron';
import TemplateController from '../../controllers/TemplateController/TemplateController';
import { authMiddleware, loggerMiddleware } from '../../middleware/ipcMiddleware';

export const registerTemplateRoutes = () => {
  ipcMain.handle('save-template', authMiddleware(loggerMiddleware(TemplateController.saveTemplate)));
  ipcMain.handle('get-templates', authMiddleware(loggerMiddleware(TemplateController.getTemplates)));
  ipcMain.handle('delete-template', authMiddleware(loggerMiddleware(TemplateController.deleteTemplate)));
};
