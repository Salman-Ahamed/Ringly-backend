import type { NextFunction, Request, Response } from 'express';
import { ApiError } from './errorHandler';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

const MAX_CONTACTS = 10000;
const MAX_CONTACT_NUMBER_LENGTH = 50;
const MAX_CONTACT_NAME_LENGTH = 255;
const MAX_PHOTO_URL_LENGTH = 2048;
const MAX_PUBLIC_ID_LENGTH = 512;
const MAX_DATA_URL_LENGTH = 3500000;

export function validateRegister(req: Request, _res: Response, next: NextFunction): void {
  if (!isRecord(req.body)) {
    next(new ApiError(400, 'Request body must be a JSON object'));
    return;
  }
  if (!isNonEmptyString(req.body.deviceId)) {
    next(new ApiError(400, 'deviceId is required'));
    return;
  }
  if (!isNonEmptyString(req.body.name)) {
    next(new ApiError(400, 'name is required'));
    return;
  }
  next();
}

export function validateSync(req: Request, _res: Response, next: NextFunction): void {
  if (!isRecord(req.body)) {
    next(new ApiError(400, 'Request body must be a JSON object'));
    return;
  }
  if (!isNonEmptyString(req.body.userId)) {
    next(new ApiError(400, 'userId is required'));
    return;
  }
  if (!Array.isArray(req.body.contacts)) {
    next(new ApiError(400, 'contacts must be an array'));
    return;
  }
  if (req.body.contacts.length > MAX_CONTACTS) {
    next(new ApiError(400, `contacts must not exceed ${MAX_CONTACTS} entries`));
    return;
  }
  for (const contact of req.body.contacts) {
    if (!isRecord(contact)) {
      next(new ApiError(400, 'Each contact must be an object'));
      return;
    }
    if (
      typeof contact.number !== 'string' ||
      contact.number.trim().length === 0 ||
      contact.number.length > MAX_CONTACT_NUMBER_LENGTH
    ) {
      next(new ApiError(400, 'Each contact must have a valid number'));
      return;
    }
    if (
      typeof contact.name !== 'string' ||
      contact.name.trim().length === 0 ||
      contact.name.length > MAX_CONTACT_NAME_LENGTH
    ) {
      next(new ApiError(400, 'Each contact must have a valid name'));
      return;
    }
    if (
      contact.photoUrl !== undefined &&
      contact.photoUrl !== null &&
      (typeof contact.photoUrl !== 'string' || contact.photoUrl.length > MAX_PHOTO_URL_LENGTH)
    ) {
      next(new ApiError(400, 'photoUrl must be a valid string'));
      return;
    }
    if (
      contact.photoPublicId !== undefined &&
      contact.photoPublicId !== null &&
      (typeof contact.photoPublicId !== 'string' || contact.photoPublicId.length > MAX_PUBLIC_ID_LENGTH)
    ) {
      next(new ApiError(400, 'photoPublicId must be a valid string'));
      return;
    }
  }
  next();
}

export function validateUpload(req: Request, _res: Response, next: NextFunction): void {
  if (!isRecord(req.body)) {
    next(new ApiError(400, 'Request body must be a JSON object'));
    return;
  }
  const { dataUrl } = req.body;
  if (typeof dataUrl !== 'string' || dataUrl.trim().length === 0) {
    next(new ApiError(400, 'dataUrl is required'));
    return;
  }
  if (!/^data:image\//i.test(dataUrl)) {
    next(new ApiError(400, 'dataUrl must be an image data URL'));
    return;
  }
  if (dataUrl.length > MAX_DATA_URL_LENGTH) {
    next(new ApiError(400, 'Image is too large'));
    return;
  }
  next();
}