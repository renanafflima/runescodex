import { detectTicketImageMime } from './ticket-evidence.bytes';

describe('ticket image bytes', () => {
  it('detects jpeg, png and webp from the file bytes', () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const webp = Buffer.alloc(12);
    webp.write('RIFF', 0, 'ascii');
    webp.write('WEBP', 8, 'ascii');

    expect(detectTicketImageMime(jpeg)).toBe('image/jpeg');
    expect(detectTicketImageMime(png)).toBe('image/png');
    expect(detectTicketImageMime(webp)).toBe('image/webp');
    expect(detectTicketImageMime(Buffer.from('plain'))).toBeNull();
  });
});
