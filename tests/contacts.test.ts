import request from 'supertest';
import { createApp } from '../src/app';
import { User } from '../src/models/User';
import { Contact } from '../src/models/Contact';

jest.mock('../src/models/User');
jest.mock('../src/models/Contact');

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

  it('upserts contacts and returns synced count', async () => {
    userMocks.findById.mockResolvedValue({ _id: 'user-1' } as never);

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

    const res = await request(app).post('/contacts/sync').send({
      userId: 'user-1',
      contacts: [{ number: 'abc', name: 'Bad Number' }],
    });

    expect(res.status).toBe(200);
    expect(res.body.synced).toBe(0);
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

  it('deletes a contact and returns success', async () => {
    contactMocks.findByIdAndDelete.mockResolvedValue({ _id: { toString: () => 'c1' } } as never);

    const res = await request(app).delete('/contacts/c1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, deletedId: 'c1' });
  });

  it('returns 404 when contact not found', async () => {
    contactMocks.findByIdAndDelete.mockResolvedValue(null);

    const res = await request(app).delete('/contacts/missing');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Contact not found');
  });
});