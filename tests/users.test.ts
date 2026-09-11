import request from 'supertest';
import { createApp } from '../src/app';
import { User } from '../src/models/User';

jest.mock('../src/models/User');

const app = createApp();

describe('POST /users/register', () => {
  const mocks = User as jest.Mocked<typeof User>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a new user and returns 201 with userId', async () => {
    mocks.findOne.mockResolvedValue(null);
    mocks.create.mockResolvedValue({ _id: { toString: () => 'user-123' } } as never);

    const res = await request(app).post('/users/register').send({
      deviceId: 'device-1',
      name: 'Salman',
    });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ userId: 'user-123' });
  });

  it('returns existing userId (upsert) for a known deviceId', async () => {
    mocks.findOne.mockResolvedValue({ _id: { toString: () => 'existing-id' } } as never);

    const res = await request(app).post('/users/register').send({
      deviceId: 'device-1',
      name: 'Salman',
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ userId: 'existing-id' });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('returns 400 when deviceId is missing', async () => {
    const res = await request(app).post('/users/register').send({ name: 'Salman' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('deviceId is required');
  });

  it('returns 400 when name is missing', async () => {
    const res = await request(app).post('/users/register').send({ deviceId: 'd1' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('name is required');
  });
});