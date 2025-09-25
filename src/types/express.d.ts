// Type declarations for extending Express Request interface
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export {};
