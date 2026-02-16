import User from '../../models/UserModel/User';

class UserService {
  static async getAllUsers() {
    return await User.findAll();
  }

  static async createUser(userData: any) {
    return await User.create(userData);
  }

  static async getUserById(id: string) {
    return await User.findByPk(id);
  }

  static async getUserByEmail(email: string) {
    return await User.findOne({ where: { email } });
  }
}

export default UserService;
