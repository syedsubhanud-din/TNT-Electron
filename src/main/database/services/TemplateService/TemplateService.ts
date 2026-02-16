import Template from '../../models/TemplateModel/Template';

class TemplateService {
  static async saveTemplate(templateData: any) {
    return await Template.create(templateData);
  }

  static async getAllTemplates() {
    return await Template.findAll({
      order: [['createdAt', 'DESC']]
    });
  }

  static async deleteTemplate(id: string) {
    return await Template.destroy({ where: { id } });
  }
}

export default TemplateService;
