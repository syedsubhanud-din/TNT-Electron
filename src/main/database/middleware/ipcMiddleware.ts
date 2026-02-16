import { IpcMainInvokeEvent } from 'electron';

// Basic session tracking in-memory
let currentUser: any = null;

export const setCurrentUser = (user: any) => {
  currentUser = user;
};

export const getCurrentUser = () => currentUser;

export const loggerMiddleware = (handler: Function) => {
  return async (event: IpcMainInvokeEvent, ...args: any[]) => {
    console.log(`[IPC Request] Handling: ${handler.name}`);
    const result = await handler(event, ...args);
    return result;
  };
};

export const authMiddleware = (handler: Function) => {
  return async (event: IpcMainInvokeEvent, ...args: any[]) => {
    // Check if user is logged in
    // Note: 'login' and 'signup' should ideally skip this middleware
    if (!currentUser) {
      return { success: false, error: 'Unauthorized: Please login first' };
    }
    
    // Basic verification of IPC source
    if (!event.senderFrame) {
      return { success: false, error: 'Unauthorized IPC call' };
    }
    
    return await handler(event, ...args);
  };
};
