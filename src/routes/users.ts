import { Router } from 'express';
import { User } from '../models/User';
import { ApiError } from '../middleware/errorHandler';
import { validateRegister } from '../middleware/validate';

interface RegisterRequest {
  deviceId: string;
  name: string;
}

export const userRouter = Router();

userRouter.post('/register', validateRegister, async (req, res, next) => {
  try {
    const { deviceId, name } = req.body as RegisterRequest;

    const existing = await User.findOne({ deviceId });
    if (existing) {
      res.json({ userId: existing._id.toString() });
      return;
    }

    const user = await User.create({ deviceId, name });
    res.status(201).json({ userId: user._id.toString() });
  } catch (error) {
    if (error instanceof Error && error.name === 'MongoServerError') {
      next(new ApiError(409, 'Registration conflict', (error as { message?: string }).message));
      return;
    }
    next(error);
  }
});