import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

export enum FileContext {
  POLITICAL_PARTY_LOGO = 'political-party-logos',
  INCIDENT_MEDIA = 'incident-media',
  RESULT_DOCUMENT = 'result-documents',
}

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private s3Client: S3Client;
  private bucketName: string;
  private endpointUrl: string;

  constructor(private configService: ConfigService) {
    this.bucketName = this.configService.get<string>('storage.bucketName')!;
    this.endpointUrl = this.configService.get<string>('storage.endpointUrl')!;

    this.s3Client = new S3Client({
      region: 'auto', // R2 uses 'auto'
      endpoint: this.endpointUrl,
      credentials: {
        accessKeyId: this.configService.get<string>('storage.accessKeyId')!,
        secretAccessKey: this.configService.get<string>(
          'storage.secretAccessKey',
        )!,
      },
    });
  }

  /**
   * Validates that an uploaded media file exists, adheres to size boundaries
   * (Image <= 10MB, Video <= 50MB), and matches authorized magic bytes.
   * If invalid, deletes the file from storage and throws BadRequestException.
   */
  async validateMediaFile(
    key: string,
    expectedType: 'image' | 'video',
  ): Promise<{ valid: boolean; sizeBytes: number; mimeType?: string }> {
    if (!key) {
      throw new BadRequestException('Storage file key must be provided.');
    }

    const maxSizeBytes =
      expectedType === 'image' ? MAX_IMAGE_SIZE_BYTES : MAX_VIDEO_SIZE_BYTES;
    const maxMb = expectedType === 'image' ? '10MB' : '50MB';

    try {
      // 1. Verify object existence and size via HeadObjectCommand
      const headCommand = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      const headResult = await this.s3Client.send(headCommand);

      const sizeBytes = headResult.ContentLength || 0;
      if (sizeBytes <= 0) {
        await this.deleteFile(key);
        throw new BadRequestException(
          `Uploaded file "${key}" is empty (0 bytes).`,
        );
      }

      if (sizeBytes > maxSizeBytes) {
        await this.deleteFile(key);
        throw new BadRequestException(
          `Uploaded file exceeds allowable ${expectedType} limit of ${maxMb} (received: ${(sizeBytes / (1024 * 1024)).toFixed(2)} MB).`,
        );
      }

      // 2. Fetch first 512 bytes to inspect magic numbers
      const getRangeCommand = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Range: 'bytes=0-511',
      });
      const getResult = await this.s3Client.send(getRangeCommand);
      const stream = getResult.Body as any;

      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }
      const headerBuffer = Buffer.concat(chunks);

      const isValidMagic = this.verifyMagicBytes(headerBuffer, expectedType);
      if (!isValidMagic) {
        await this.deleteFile(key);
        throw new BadRequestException(
          `Uploaded file "${key}" failed security validation: binary signatures do not match authorized ${expectedType} formats.`,
        );
      }

      return {
        valid: true,
        sizeBytes,
        mimeType: headResult.ContentType,
      };
    } catch (error: any) {
      if (
        error.name === 'NotFound' ||
        error.$metadata?.httpStatusCode === 404
      ) {
        throw new BadRequestException(
          `File with key "${key}" was not found in storage bucket.`,
        );
      }
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Error validating storage media: ${error.message}`);
      throw new BadRequestException(
        `Failed to validate storage media: ${error.message}`,
      );
    }
  }

  /**
   * Validates binary signature / magic bytes of the file header.
   */
  private verifyMagicBytes(
    buffer: Buffer,
    expectedType: 'image' | 'video',
  ): boolean {
    if (!buffer || buffer.length < 4) return false;

    if (expectedType === 'image') {
      // JPEG: FF D8 FF
      const isJpeg =
        buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
      // PNG: 89 50 4E 47
      const isPng =
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47;
      // WebP: RIFF ... WEBP
      const isWebP =
        buffer.toString('ascii', 0, 4) === 'RIFF' &&
        buffer.toString('ascii', 8, 12) === 'WEBP';
      // GIF: GIF8
      const isGif = buffer.toString('ascii', 0, 4) === 'GIF8';

      return isJpeg || isPng || isWebP || isGif;
    }

    if (expectedType === 'video') {
      // MP4 / MOV: bytes 4-8 is 'ftyp'
      const isFtyp =
        buffer.length >= 8 && buffer.toString('ascii', 4, 8) === 'ftyp';
      // WebM / MKV: 1A 45 DF A3
      const isWebM =
        buffer[0] === 0x1a &&
        buffer[1] === 0x45 &&
        buffer[2] === 0xdf &&
        buffer[3] === 0xa3;
      // QuickTime / MPEG: contains 'moov', 'mdat'
      const hasMoovOrMdat =
        buffer.includes(Buffer.from('moov')) ||
        buffer.includes(Buffer.from('mdat'));

      return isFtyp || isWebM || hasMoovOrMdat;
    }

    return false;
  }

  /**
   * Generates a presigned PUT URL for direct-to-bucket client uploads (Cloudflare R2 compatible).
   */
  async getPresignedUploadUrl(
    context: FileContext | string,
    contentType: string,
    maxSizeBytes?: number,
    originalFilename?: string,
  ) {
    const extension =
      originalFilename?.split('.').pop() || contentType.split('/')[1] || 'bin';
    const key = `${context}/${uuidv4()}.${extension}`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: 900, // 15 minutes
    });

    // Cloudflare R2 specific public URL (if custom domain is mapped to bucket name)
    const publicUrl =
      context === FileContext.POLITICAL_PARTY_LOGO
        ? `${this.endpointUrl}/${this.bucketName}/${key}`
        : null;

    return {
      uploadUrl,
      fileKey: key,
      publicUrl,
      expiresIn: 900,
    };
  }

  /**
   * Generates a short-lived URL for downloading a private file.
   */
  async getPresignedDownloadUrl(
    key: string,
    expiresInSeconds = 900,
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });
    return getSignedUrl(this.s3Client, command, {
      expiresIn: expiresInSeconds,
    });
  }

  /**
   * Deletes a file from the bucket.
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      await this.s3Client.send(command);
    } catch (error: any) {
      this.logger.error(
        `Failed to delete file from storage: ${key}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Legacy method for direct backend uploads (used by Incident and Result modules)
   * TODO: Migrate to getPresignedUploadUrl
   */
  async uploadFile(file: Express.Multer.File, path: string): Promise<string> {
    const extension = file.originalname.split('.').pop() || 'bin';
    const key = `${path}/${uuidv4()}.${extension}`;
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    });
    await this.s3Client.send(command);
    return `${this.endpointUrl}/${this.bucketName}/${key}`;
  }

  async uploadFiles(
    files: Express.Multer.File[],
    path: string,
  ): Promise<string[]> {
    const uploadPromises = files.map((file) => this.uploadFile(file, path));
    return Promise.all(uploadPromises);
  }
}
