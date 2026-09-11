import { connect } from 'mongoose';

export async function connectDB(uri: string): Promise<void> {
  try {
    await connect(uri);
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}