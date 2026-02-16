import UserService from '../../services/UserService/UserService';
import { setCurrentUser } from '../../middleware/ipcMiddleware';

class UserController {
  static async getUsers() {
    try {
      const users = await UserService.getAllUsers();
      return { success: true, data: users };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  static async createUser(event: any, userData: any) {
    try {
      const user = await UserService.createUser(userData);
      return { success: true, data: user };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  static async login(event: any, { email, password }: any) {
    try {
      const user: any = await UserService.getUserByEmail(email);
      if (!user || user.password !== password) {
        return { success: false, error: 'Invalid email or password' };
      }
      
      // Set the session
      setCurrentUser(user);
      
      return { success: true, data: user };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  static async logout() {
    setCurrentUser(null);
    return { success: true, message: 'Logged out successfully' };
  }
}

export default UserController;
