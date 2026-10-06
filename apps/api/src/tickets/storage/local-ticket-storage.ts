import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import path from 'path';
import { publicHttpsUrl } from '../../common/https-url';
import { isSafeEvidenceStorageKey } from '../tickets.constants';
import {
  TicketStorageError,
  type StoredTicketObject,
  type TicketStorage,
  type TicketStorageObject,
} from './ticket-storage';

export class LocalTicketStorage implements TicketStorage {
  private readonly rootDir: string;

  constructor(
    rootDir: string,
    private readonly publicBaseUrl: string | null,
  ) {
    this.rootDir = path.resolve(
      rootDir || path.join(process.cwd(), '.ticket-storage'),
    );
  }

  async put(object: TicketStorageObject): Promise<StoredTicketObject> {
    const target = this.resolveKey(object.storageKey);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, object.body);
    return {
      storageKey: object.storageKey,
      url: this.objectUrl(object.storageKey),
    };
  }

  async get(storageKey: string): Promise<Buffer> {
    try {
      return await readFile(this.resolveKey(storageKey));
    } catch {
      throw new TicketStorageError('Evidence storage failed');
    }
  }

  async delete(storageKey: string): Promise<void> {
    await rm(this.resolveKey(storageKey), { force: true });
  }

  private objectUrl(storageKey: string) {
    if (!this.publicBaseUrl) {
      return null;
    }
    return publicHttpsUrl(`${this.publicBaseUrl}/${storageKey}`);
  }

  private resolveKey(storageKey: string) {
    if (!isSafeEvidenceStorageKey(storageKey)) {
      throw new TicketStorageError('Invalid evidence storage key');
    }
    const target = path.resolve(this.rootDir, storageKey);
    const relative = path.relative(this.rootDir, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new TicketStorageError('Invalid evidence storage key');
    }
    return target;
  }
}
