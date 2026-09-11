import request from 'supertest';
import { createApp } from '../src/app';
import { uploadPhoto } from '../src/utils/cloudinary';

jest.mock('../src/utils/cloudinary', () => ({
  uploadPhoto: jest.fn(),
  deletePhoto: jest.fn(),
}));

const app = createApp();

describe('POST /photos/upload', () => {
  const photoMocks = uploadPhoto as jest.MockedFunction<typeof uploadPhoto>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uploads a data URL and returns the Cloudinary URL', async () => {
    photoMocks.mockResolvedValue({ secureUrl: 'https://res.cloudinary.com/x/a.jpg', publicId: 'ringly/a' });

    const res = await request(app)
      .post('/photos/upload')
      .send({ dataUrl: 'data:image/jpeg;base64,iVBORw0KGgo=' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      photoUrl: 'https://res.cloudinary.com/x/a.jpg',
      photoPublicId: 'ringly/a',
    });
    expect(photoMocks).toHaveBeenCalledWith('data:image/jpeg;base64,iVBORw0KGgo=');
  });

  it('returns 400 when dataUrl is missing', async () => {
    const res = await request(app).post('/photos/upload').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('dataUrl is required');
  });

  it('returns 400 when dataUrl is not an image', async () => {
    const res = await request(app).post('/photos/upload').send({ dataUrl: 'data:text/plain;base64,abc' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('dataUrl must be an image data URL');
  });

  it('returns 400 when the image is too large', async () => {
    const huge = 'data:image/jpeg;base64,' + 'a'.repeat(3500001);
    const res = await request(app).post('/photos/upload').send({ dataUrl: huge });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Image is too large');
  });

  it('propagates upload failures as 500', async () => {
    photoMocks.mockRejectedValue(new Error('cloudinary down'));

    const res = await request(app)
      .post('/photos/upload')
      .send({ dataUrl: 'data:image/png;base64,iVBORw0KGgo=' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal server error');
  });
});