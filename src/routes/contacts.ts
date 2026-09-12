import { Router } from 'express';
import { Contact, type IContact } from '../models/Contact';
import { User } from '../models/User';
import { ApiError } from '../middleware/errorHandler';
import { validateSync } from '../middleware/validate';
import { normalizeNumber } from '../utils/numberNormalizer';
import { deletePhoto } from '../utils/cloudinary';

interface SyncContactInput {
  number: string;
  name: string;
  photoUrl?: string | null;
  photoPublicId?: string | null;
}

interface SyncRequest {
  userId: string;
  contacts: SyncContactInput[];
}

interface LookupMatch {
  name: string;
  photoUrl: string | null;
  ownerName: string;
}

type ContactDoc = IContact & { photoUrl: string | null };

export const contactRouter = Router();

contactRouter.post('/sync', validateSync, async (req, res, next) => {
  try {
    const { userId, contacts } = req.body as SyncRequest;

    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    let synced = 0;
    const resultContacts: ContactDoc[] = [];

    for (const contact of contacts) {
      const normalized = normalizeNumber(contact.number);
      if (!normalized) continue;

      const photoUrl = contact.photoUrl ?? null;
      const photoPublicId = contact.photoPublicId ?? null;

      const existing = await Contact.findOne({ number: normalized, ownerId: user._id })
        .select('photoPublicId')
        .lean();
      if (existing?.photoPublicId && existing.photoPublicId !== photoPublicId) {
        try {
          await deletePhoto(existing.photoPublicId);
        } catch {
          // ignore photo cleanup failures
        }
      }

      const saved = await Contact.findOneAndUpdate(
        { number: normalized, ownerId: user._id },
        { number: normalized, name: contact.name, photoUrl, photoPublicId, ownerId: user._id },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      if (saved) {
        synced += 1;
        resultContacts.push(saved.toObject() as ContactDoc);
      }
    }

    res.json({ synced, contacts: resultContacts });
  } catch (error) {
    next(error);
  }
});

contactRouter.get('/', async (req, res, next) => {
  try {
    const { userId } = req.query;

    if (typeof userId !== 'string' || userId.trim().length === 0) {
      throw new ApiError(400, 'userId query parameter is required');
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    const contacts = await Contact.find({ ownerId: userId }).sort({ updatedAt: -1 }).lean();

    res.json({ contacts });
  } catch (error) {
    next(error);
  }
});

contactRouter.get('/lookup/:number', async (req, res, next) => {
  try {
    const normalized = normalizeNumber(req.params.number);
    if (!normalized) {
      throw new ApiError(400, 'Invalid number format');
    }

    const matches = await Contact.find({ number: normalized }).sort({ updatedAt: -1 }).lean();

    if (matches.length === 0) {
      res.json({ found: false, matches: [] });
      return;
    }

    const ownerIds = [...new Set(matches.map((m) => m.ownerId.toString()))];
    const owners = await User.find({ _id: { $in: ownerIds } }).select('name').lean();
    const ownerMap = new Map(owners.map((o) => [o._id.toString(), o.name]));

    const result: LookupMatch[] = matches.map((m) => ({
      name: m.name,
      photoUrl: (m as ContactDoc).photoUrl ?? null,
      ownerName: ownerMap.get(m.ownerId.toString()) ?? 'Unknown',
    }));

    res.json({ found: true, matches: result });
  } catch (error) {
    next(error);
  }
});

contactRouter.delete('/:contactId', async (req, res, next) => {
  try {
    const { contactId } = req.params;
    const { userId } = req.query;

    if (typeof userId !== 'string' || userId.trim().length === 0) {
      throw new ApiError(400, 'userId query parameter is required');
    }

    const contact = await Contact.findById(contactId);
    if (!contact) {
      throw new ApiError(404, 'Contact not found');
    }

    if (contact.ownerId.toString() !== userId) {
      throw new ApiError(403, 'Not authorized to delete this contact');
    }

    if (contact.photoPublicId) {
      try {
        await deletePhoto(contact.photoPublicId);
      } catch {
        // ignore photo cleanup failures
      }
    }

    await Contact.deleteOne({ _id: contact._id });

    res.json({ success: true, deletedId: contact._id.toString() });
  } catch (error) {
    next(error);
  }
});