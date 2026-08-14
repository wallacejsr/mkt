import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface DecodedUser {
  userId: string;
  uid: string;
  email: string;
}

export interface AuthRequest extends Request {
  user?: DecodedUser;
}

export const JWT_SECRET_KEY = process.env.JWT_SECRET || 'mkt-agro-bw-secret-key-2026';

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET_KEY) as DecodedUser;
    req.user = decoded;
    next();
  } catch (error: any) {
    return res.status(401).json({
      error: 'Unauthorized: Token expired or invalid',
      code: 'auth/invalid-token'
    });
  }
};
