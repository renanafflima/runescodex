import { Logger } from '@nestjs/common';
import type { S3Client } from '@aws-sdk/client-s3';
import { publicHttpsUrl } from '../../common/https-url';
import { isSafeEvidenceStorageKey } from '../tickets.constants';
import {
  TicketStorageError,
  TicketStorageNotConfiguredError,
  type StoredTicketObject,
  type TicketStorage,
  type TicketStorageObject,
} from './ticket-storage';

type S3Config = {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
  forcePathStyle: boolean;
};

export class S3TicketStorage implements TicketStorage {
  private readonly logger = new Logger(S3TicketStorage.name);
  private client: S3Client | null = null;

  constructor(
    private readonly config: S3Config | null,
    private readonly publicBaseUrl: string | null,
  ) {}

  async put(object: TicketStorageObject): Promise<StoredTicketObject> {
    this.assertKey(object.storageKey);
    const { client, commands } = await this.ready();
    try {
      await client.send(
        new commands.PutObjectCommand({
          Bucket: this.config?.bucket,
          Key: object.storageKey,
          Body: object.body,
          ContentType: object.mimeType,
          CacheControl: 'private, max-age=0',
        }),
      );
    } catch (error) {
      this.rethrow(error);
    }
    return {
      storageKey: object.storageKey,
      url: this.objectUrl(object.storageKey),
    };
  }

  async get(storageKey: string): Promise<Buffer> {
    this.assertKey(storageKey);
    const { client, commands } = await this.ready();
    try {
      const response = await client.send(
        new commands.GetObjectCommand({
          Bucket: this.config?.bucket,
          Key: storageKey,
        }),
      );
      if (!response.Body) {
        throw new TicketStorageError('Evidence storage failed');
      }
      const bytes = await response.Body.transformToByteArray();
      return Buffer.from(bytes);
    } catch (error) {
      this.rethrow(error);
    }
  }

  async delete(storageKey: string): Promise<void> {
    this.assertKey(storageKey);
    const { client, commands } = await this.ready();
    try {
      await client.send(
        new commands.DeleteObjectCommand({
          Bucket: this.config?.bucket,
          Key: storageKey,
        }),
      );
    } catch (error) {
      this.rethrow(error);
    }
  }

  private async ready() {
    if (!this.config) {
      throw new TicketStorageNotConfiguredError();
    }
    const commands = await import('@aws-sdk/client-s3');
    if (!this.client) {
      this.client = new commands.S3Client({
        region: this.config.region,
        endpoint: this.config.endpoint,
        forcePathStyle: this.config.forcePathStyle,
        credentials: {
          accessKeyId: this.config.accessKeyId,
          secretAccessKey: this.config.secretAccessKey,
        },
      });
    }
    return { client: this.client, commands };
  }

  private objectUrl(storageKey: string) {
    if (!this.publicBaseUrl) {
      return null;
    }
    return publicHttpsUrl(`${this.publicBaseUrl}/${storageKey}`);
  }

  private assertKey(storageKey: string) {
    if (!isSafeEvidenceStorageKey(storageKey)) {
      throw new TicketStorageError('Invalid evidence storage key');
    }
  }

  private rethrow(error: unknown): never {
    if (error instanceof TicketStorageError) {
      throw error;
    }
    this.logger.error('Evidence storage request failed');
    throw new TicketStorageError('Evidence storage failed');
  }
}
