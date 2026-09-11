import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

const userSchema = new Schema(
  {
    deviceId: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export interface IUser extends InferSchemaType<typeof userSchema> {
  _id: import('mongoose').Types.ObjectId;
}

userSchema.index({ deviceId: 1 }, { unique: true });

export const User: Model<IUser> =
  (models.User as Model<IUser> | undefined) ?? model<IUser>('User', userSchema);