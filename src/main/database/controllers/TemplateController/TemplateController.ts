import TemplateService from '../../services/TemplateService/TemplateService';

class TemplateController {
  static async saveTemplate(event: any, templateData: any) {
    try {
      const template = await TemplateService.saveTemplate(templateData);
      return { success: true, data: template };
    } catch (error: any) {
      console.error('Save template error:', error);
      return { success: false, error: error.message };
    }
  }

  static async getTemplates() {
    try {
      const templates = await TemplateService.getAllTemplates();
      return { success: true, data: templates };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  static async deleteTemplate(event: any, id: string) {
    try {
      await TemplateService.deleteTemplate(id);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}

export default TemplateController;
