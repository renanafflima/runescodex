import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { LocalTicketStorage } from './local-ticket-storage';
import { S3TicketStorage } from './s3-ticket-storage';
import {
  createTicketStorage,
  TicketStorageNotConfiguredError,
} from './ticket-storage';

const TICKET_ID = '66666666-6666-4666-8666-666666666666';
const EVIDENCE_ID = '77777777-7777-4777-8777-777777777777';
const STORAGE_KEY = `tickets/${TICKET_ID}/${EVIDENCE_ID}.jpg`;

describe('ticket storage', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'ticket-evidence-'));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('stores and deletes a local file without using the original filename', async () => {
    const storage = new LocalTicketStorage(directory, null);
    const body = Buffer.from([0xff, 0xd8, 0xff, 0x01]);

    const stored = await storage.put({
      storageKey: STORAGE_KEY,
      body,
      mimeType: 'image/jpeg',
    });

    expect(stored.url).toBeNull();
    expect(stored.storageKey).toBe(STORAGE_KEY);
    await expect(storage.get(STORAGE_KEY)).resolves.toEqual(body);
    await storage.delete(STORAGE_KEY);
    await expect(storage.get(STORAGE_KEY)).rejects.toThrow(
      'Evidence storage failed',
    );
  });

  it('rejects a storage key that leaves the evidence directory', async () => {
    const storage = new LocalTicketStorage(directory, null);

    await expect(
      storage.put({
        storageKey: `tickets/${TICKET_ID}/../secret.jpg`,
        body: Buffer.from([0xff, 0xd8, 0xff]),
        mimeType: 'image/jpeg',
      }),
    ).rejects.toThrow('Invalid evidence storage key');
  });

  it('uses local storage in development and refuses it outside development', () => {
    const local = createTicketStorage({ APP_ENV: 'development' });
    expect(local).toBeInstanceOf(LocalTicketStorage);

    expect(() =>
      createTicketStorage({
        APP_ENV: 'production',
        TICKET_STORAGE_DRIVER: 'local',
      }),
    ).toThrow('TICKET_STORAGE_DRIVER=local is only allowed');
  });

  it('does not call S3 when evidence storage is not configured', async () => {
    const storage = new S3TicketStorage(null, null);

    await expect(
      storage.put({
        storageKey: STORAGE_KEY,
        body: Buffer.from([0xff, 0xd8, 0xff]),
        mimeType: 'image/jpeg',
      }),
    ).rejects.toBeInstanceOf(TicketStorageNotConfiguredError);
  });
});
