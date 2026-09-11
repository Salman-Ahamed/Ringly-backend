import 'dotenv/config';
import { createApp } from './app';
import { connectDB } from './config/db';

const PORT = process.env.PORT || 3000;

async function start(): Promise<void> {
  if (process.env.MONGODB_URI) {
    await connectDB(process.env.MONGODB_URI);
  } else {
    console.warn('MONGODB_URI not set — skipping DB connection');
  }

  const app = createApp();
  app.listen(PORT, () => {
    console.log(`Ringly backend listening on port ${PORT}`);
  });
}

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});