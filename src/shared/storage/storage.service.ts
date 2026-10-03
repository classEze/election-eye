import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { v4 as uuidv4 } from 'uuid';

export enum FileContext {
  POLITICAL_PARTY_LOGO = 'political-party-logos',
  INCIDENT_MEDIA = 'incident-media',
  RESULT_DOCUMENT = 'result-documents',
}

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
        secretAccessKey: this.configService.get<string>('storage.secretAccessKey')!,
      },
    });
  }

  /**
   * Generates a presigned POST URL for direct-to-bucket client uploads.
   * Uses conditions to enforce file size limits and content types.
   */
  async getPresignedUploadUrl(
    context: FileContext,
    contentType: string,
    maxSizeBytes: number,
    originalFilename?: string,
  ) {
    const extension = originalFilename?.split('.').pop() || contentType.split('/')[1] || 'bin';
    const key = `${context}/${uuidv4()}.${extension}`;

    const { url, fields } = await createPresignedPost(this.s3Client, {
      Bucket: this.bucketName,
      Key: key,
      Conditions: [
        ['content-length-range', 0, maxSizeBytes],
        ['starts-with', '$Content-Type', contentType],
      ],
      Fields: {
        'Content-Type': contentType,
      },
      Expires: 900, // 15 minutes
    });

    // Cloudflare R2 specific public URL (if custom domain is mapped to bucket name)
    const publicUrl =
      context === FileContext.POLITICAL_PARTY_LOGO
        ? `${this.endpointUrl}/${this.bucketName}/${key}`
        : null;

    return {
      uploadUrl: url,
      uploadFields: fields,
      fileKey: key,
      publicUrl,
    };
  }

  /**
   * Generates a short-lived URL for downloading a private file.
   */
  async getPresignedDownloadUrl(key: string, expiresInSeconds = 900): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });
    return getSignedUrl(this.s3Client, command, { expiresIn: expiresInSeconds });
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
      this.logger.error(`Failed to delete file from storage: ${key}`, error.stack);
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

  async uploadFiles(files: Express.Multer.File[], path: string): Promise<string[]> {
    const uploadPromises = files.map((file) => this.uploadFile(file, path));
    return Promise.all(uploadPromises);
  }
}
