import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { userRouter } from './routes/users';
import { contactRouter } from './routes/contacts';
import { photoRouter } from './routes/photos';
import { errorHandler, notFound } from './middleware/errorHandler';

export function createApp(): express.Express {
  const app = express();

  app.use(cors());
  app.use(morgan('dev'));
  app.use(express.json({ limit: '5mb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/users', userRouter);
  app.use('/contacts', contactRouter);
  app.use('/photos', photoRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}