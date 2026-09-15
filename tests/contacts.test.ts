import request from 'supertest';
import { createApp } from '../src/app';
import { User } from '../src/models/User';
import { Contact } from '../src/models/Contact';
import { deletePhoto } from '../src/utils/cloudinary';

jest.mock('../src/models/User');
jest.mock('../src/models/Contact');
jest.mock('../src/utils/cloudinary', () => ({
  uploadPhoto: jest.fn(),
  deletePhoto: jest.fn(),
}));

const app = createApp();

describe('POST /contacts/sync', () => {
  const userMocks = User as jest.Mocked<typeof User>;
  const contactMocks = Contact as jest.Mocked<typeof Contact>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 404 when user does not exist', async () => {
    userMocks.findById.mockResolvedValue(null);

    const res = await request(app).post('/contacts/sync').send({
      userId: 'user-1',
      contacts: [],
    });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('User not found');
  });

  it('rejects invalid payloads (400)', async () => {
    const res = await request(app).post('/contacts/sync').send({ userId: 'u1' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('contacts must be an array');
  });

  it('rejects non-string photoUrl (400)', async () => {
    const res = await request(app).post('/contacts/sync').send({
      userId: 'u1',
      contacts: [{ number: '01712345678', name: 'Rahim', photoUrl: 42 }],
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('photoUrl must be a valid string');
  });

  it('rejects overly large sync payloads (400)', async () => {
    const contacts = Array.from({ length: 10001 }, (_, i) => ({ number: `0171${i}`.padEnd(11, '0'), name: `C${i}` }));
    const res = await request(app).post('/contacts/sync').send({ userId: 'u1', contacts });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('contacts must not exceed 10000 entries');
  });

  it('upserts contacts and returns synced count', async () => {
    userMocks.findById.mockResolvedValue({ _id: 'user-1' } as never);
    contactMocks.findOne.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      }),
    } as never);

    contactMocks.findOneAndUpdate
      .mockResolvedValueOnce({
        toObject: () => ({
          number: '+8801712345678',
          name: 'Rahim',
          photoUrl: null,
          ownerId: 'user-1',
        }),
      } as never)
      .mockResolvedValueOnce({
        toObject: () => ({
          number: '+8801811111111',
          name: 'Karim',
          photoUrl: null,
          ownerId: 'user-1',
        }),
      } as never);

    const res = await request(app).post('/contacts/sync').send({
      userId: 'user-1',
      contacts: [
        { number: '01712345678', name: 'Rahim' },
        { number: '+8801811111111', name: 'Karim' },
      ],
    });

    expect(res.status).toBe(200);
    expect(res.body.synced).toBe(2);
    expect(res.body.contacts).toHaveLength(2);
  });

  it('skips invalid numbers but still succeeds', async () => {
    userMocks.findById.mockResolvedValue({ _id: 'user-1' } as never);
    contactMocks.findOne.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      }),
    } as never);

    const res = await request(app).post('/contacts/sync').send({
      userId: 'user-1',
      contacts: [{ number: 'abc', name: 'Bad Number' }],
    });

    expect(res.status).toBe(200);
    expect(res.body.synced).toBe(0);
  });

  it('stores photoPublicId with the contact', async () => {
    userMocks.findById.mockResolvedValue({ _id: 'user-1' } as never);

    contactMocks.findOne.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ photoPublicId: 'pub-same' }),
      }),
    } as never);

    contactMocks.findOneAndUpdate.mockResolvedValueOnce({
      toObject: () => ({
        number: '+8801712345678',
        name: 'Rahim',
        photoUrl: 'https://x/a.jpg',
        photoPublicId: 'pub-same',
        ownerId: 'user-1',
      }),
    } as never);

    const res = await request(app).post('/contacts/sync').send({
      userId: 'user-1',
      contacts: [{ number: '01712345678', name: 'Rahim', photoUrl: 'https://x/a.jpg', photoPublicId: 'pub-same' }],
    });

    expect(res.status).toBe(200);
    expect(contactMocks.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ number: '+8801712345678' }),
      expect.objectContaining({ photoPublicId: 'pub-same', photoUrl: 'https://x/a.jpg' }),
      expect.anything()
    );
    expect(deletePhoto).not.toHaveBeenCalled();
  });

  it('purges the old photo when photoPublicId changes on sync', async () => {
    userMocks.findById.mockResolvedValue({ _id: 'user-1' } as never);

    contactMocks.findOne.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ photoPublicId: 'pub-old' }),
      }),
    } as never);

    contactMocks.findOneAndUpdate.mockResolvedValueOnce({
      toObject: () => ({
        number: '+8801712345678',
        name: 'Rahim',
        photoUrl: 'https://x/b.jpg',
        photoPublicId: 'pub-new',
        ownerId: 'user-1',
      }),
    } as never);

    const res = await request(app).post('/contacts/sync').send({
      userId: 'user-1',
      contacts: [{ number: '01712345678', name: 'Rahim', photoUrl: 'https://x/b.jpg', photoPublicId: 'pub-new' }],
    });

    expect(res.status).toBe(200);
    expect(deletePhoto).toHaveBeenCalledWith('pub-old');
  });

  it('purges the old photo when the photo is removed on sync', async () => {
    userMocks.findById.mockResolvedValue({ _id: 'user-1' } as never);

    contactMocks.findOne.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ photoPublicId: 'pub-old' }),
      }),
    } as never);

    contactMocks.findOneAndUpdate.mockResolvedValueOnce({
      toObject: () => ({
        number: '+8801712345678',
        name: 'Rahim',
        photoUrl: null,
        photoPublicId: null,
        ownerId: 'user-1',
      }),
    } as never);

    const res = await request(app).post('/contacts/sync').send({
      userId: 'user-1',
      contacts: [{ number: '01712345678', name: 'Rahim', photoUrl: null, photoPublicId: null }],
    });

    expect(res.status).toBe(200);
    expect(deletePhoto).toHaveBeenCalledWith('pub-old');
    expect(contactMocks.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ number: '+8801712345678' }),
      expect.objectContaining({ photoPublicId: null, photoUrl: null }),
      expect.anything()
    );
  });
});

describe('GET /contacts', () => {
  const contactMocks = Contact as jest.Mocked<typeof Contact>;
  const userMocks = User as jest.Mocked<typeof User>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 400 when userId is missing', async () => {
    const res = await request(app).get('/contacts');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('userId query parameter is required');
  });

  it('returns 404 when user does not exist', async () => {
    userMocks.findById.mockResolvedValue(null);

    const res = await request(app).get('/contacts?userId=user-1');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('User not found');
  });

  it('returns own contacts sorted by most recent update', async () => {
    userMocks.findById.mockResolvedValue({ _id: 'user-1' } as never);

    contactMocks.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { _id: 'c1', number: '+8801712345678', name: 'Rahim', photoUrl: null, photoPublicId: null, ownerId: 'user-1' },
          { _id: 'c2', number: '+8801811111111', name: 'Karim', photoUrl: 'https://x/a.jpg', photoPublicId: 'pub-1', ownerId: 'user-1' },
        ]),
      }),
    } as never);

    const res = await request(app).get('/contacts?userId=user-1');

    expect(res.status).toBe(200);
    expect(res.body.contacts).toHaveLength(2);
    expect(res.body.contacts[0]._id).toBe('c1');
    expect(res.body.contacts[1].photoPublicId).toBe('pub-1');
    expect(contactMocks.find).toHaveBeenCalledWith({ ownerId: 'user-1' });
    expect(contactMocks.find).toHaveBeenCalledTimes(1);
  });
});

describe('GET /contacts/pool', () => {
  const contactMocks = Contact as jest.Mocked<typeof Contact>;
  const userMocks = User as jest.Mocked<typeof User>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 400 when userId is missing', async () => {
    const res = await request(app).get('/contacts/pool');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('userId query parameter is required');
  });

  it('returns 404 when user does not exist', async () => {
    userMocks.findById.mockResolvedValue(null);

    const res = await request(app).get('/contacts/pool?userId=user-1');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('User not found');
  });

  it('returns all pool contacts enriched with ownerName', async () => {
    userMocks.findById.mockResolvedValue({ _id: 'user-1' } as never);

    contactMocks.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { _id: 'c1', number: '+8801712345678', name: 'Rahim', photoUrl: null, photoPublicId: null, ownerId: 'u1' },
          { _id: 'c2', number: '+8801811111111', name: 'Karim', photoUrl: 'https://x/a.jpg', photoPublicId: 'pub-1', ownerId: 'u2' },
        ]),
      }),
    } as never);

    (User.find as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { _id: 'u1', name: 'Salman' },
          { _id: 'u2', name: 'Rina' },
        ]),
      }),
    } as never);

    const res = await request(app).get('/contacts/pool?userId=user-1');

    expect(res.status).toBe(200);
    expect(res.body.contacts).toHaveLength(2);
    expect(res.body.contacts[0]).toEqual({
      number: '+8801712345678',
      name: 'Rahim',
      photoUrl: null,
      ownerName: 'Salman',
    });
    expect(res.body.contacts[1].ownerName).toBe('Rina');
    expect(contactMocks.find).toHaveBeenCalledWith();
    expect(contactMocks.find).toHaveBeenCalledTimes(1);
  });
});

describe('GET /contacts/lookup/:number', () => {
  const contactMocks = Contact as jest.Mocked<typeof Contact>;
  const userMocks = User as jest.Mocked<typeof User>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns not found when no matches', async () => {
    contactMocks.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      }),
    } as never);

    const res = await request(app).get('/contacts/lookup/+8801712345678');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ found: false, matches: [] });
  });

  it('returns matches with owner names', async () => {
    contactMocks.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { number: '+8801712345678', name: 'Rahim', photoUrl: null, ownerId: { toString: () => 'u1' } },
          { number: '+8801712345678', name: 'Rahim Uddin', photoUrl: 'https://x/a.jpg', ownerId: { toString: () => 'u2' } },
        ]),
      }),
    } as never);

    userMocks.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { _id: { toString: () => 'u1' }, name: 'Salman' },
          { _id: { toString: () => 'u2' }, name: 'Karim' },
        ]),
      }),
    } as never);

    const res = await request(app).get('/contacts/lookup/+8801712345678');

    expect(res.status).toBe(200);
    expect(res.body.found).toBe(true);
    expect(res.body.matches).toHaveLength(2);
    expect(res.body.matches[0]).toEqual({ name: 'Rahim', photoUrl: null, ownerName: 'Salman' });
    expect(res.body.matches[1]).toEqual({ name: 'Rahim Uddin', photoUrl: 'https://x/a.jpg', ownerName: 'Karim' });
  });

  it('returns 400 for an invalid number format', async () => {
    const res = await request(app).get('/contacts/lookup/invalid%20number');
    expect(res.status).toBe(400);
  });
});

describe('DELETE /contacts/:contactId', () => {
  const contactMocks = Contact as jest.Mocked<typeof Contact>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 400 when userId is missing', async () => {
    const res = await request(app).delete('/contacts/c1');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('userId query parameter is required');
  });

  it('deletes a contact owned by the requester', async () => {
    contactMocks.findById.mockResolvedValue({
      _id: { toString: () => 'c1' },
      ownerId: { toString: () => 'user-1' },
      photoPublicId: null,
    } as never);
    contactMocks.deleteOne.mockResolvedValue({ deletedCount: 1 } as never);

    const res = await request(app).delete('/contacts/c1?userId=user-1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, deletedId: 'c1' });
    expect(contactMocks.deleteOne).toHaveBeenCalledWith({ _id: expect.anything() });
    expect(deletePhoto).not.toHaveBeenCalled();
  });

  it('returns 404 when contact not found', async () => {
    contactMocks.findById.mockResolvedValue(null);

    const res = await request(app).delete('/contacts/missing?userId=user-1');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Contact not found');
  });

  it('returns 403 when the contact belongs to someone else', async () => {
    contactMocks.findById.mockResolvedValue({
      _id: { toString: () => 'c1' },
      ownerId: { toString: () => 'user-2' },
      photoPublicId: null,
    } as never);

    const res = await request(app).delete('/contacts/c1?userId=user-1');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Not authorized to delete this contact');
    expect(contactMocks.deleteOne).not.toHaveBeenCalled();
  });

  it('purges the Cloudinary photo before deleting the contact', async () => {
    contactMocks.findById.mockResolvedValue({
      _id: { toString: () => 'c1' },
      ownerId: { toString: () => 'user-1' },
      photoPublicId: 'pub-abc',
    } as never);
    contactMocks.deleteOne.mockResolvedValue({ deletedCount: 1 } as never);

    const res = await request(app).delete('/contacts/c1?userId=user-1');
    expect(res.status).toBe(200);
    expect(deletePhoto).toHaveBeenCalledWith('pub-abc');
    expect(contactMocks.deleteOne).toHaveBeenCalled();
  });
});