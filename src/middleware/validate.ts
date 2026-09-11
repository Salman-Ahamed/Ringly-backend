import type { NextFunction, Request, Response } from 'express';
import { ApiError } from './errorHandler';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

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
  for (const contact of req.body.contacts) {
    if (!isRecord(contact)) {
      next(new ApiError(400, 'Each contact must be an object'));
      return;
    }
    if (!isNonEmptyString(contact.number) || !isNonEmptyString(contact.name)) {
      next(new ApiError(400, 'Each contact must have a non-empty number and name'));
      return;
    }
  }
  next();
}