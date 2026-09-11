import { Router } from 'express';
import { validateUpload } from '../middleware/validate';
import { uploadPhoto } from '../utils/cloudinary';

interface UploadRequest {
  dataUrl: string;
}

export const photoRouter = Router();

photoRouter.post('/upload', validateUpload, async (req, res, next) => {
  try {
    const { dataUrl } = req.body as UploadRequest;

    const { secureUrl, publicId } = await uploadPhoto(dataUrl);

    res.json({ photoUrl: secureUrl, photoPublicId: publicId });
  } catch (error) {
    next(error);
  }
});