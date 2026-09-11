import mongoose from 'mongoose';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createApp } from '../src/app';

const app = createApp();

async function ensureDbConnection(): Promise<void> {
  if (mongoose.connection.readyState !== 1) {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGODB_URI is not set');
    }
    await mongoose.connect(uri);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    await ensureDbConnection();
  } catch (error) {
    console.error('DB connection error:', error);
    res.status(500).json({ error: 'Database not configured' });
    return;
  }
  return app(req, res);
}