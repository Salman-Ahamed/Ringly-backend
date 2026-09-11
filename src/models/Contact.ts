import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

const contactSchema = new Schema(
  {
    number: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    photoUrl: { type: String, default: null },
    ownerId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
  },
  { timestamps: true }
);

export interface IContact extends InferSchemaType<typeof contactSchema> {
  _id: import('mongoose').Types.ObjectId;
}

contactSchema.index({ number: 1 });
contactSchema.index({ ownerId: 1 });
contactSchema.index({ number: 1, ownerId: 1 }, { unique: true });

export const Contact: Model<IContact> =
  (models.Contact as Model<IContact> | undefined) ?? model<IContact>('Contact', contactSchema);