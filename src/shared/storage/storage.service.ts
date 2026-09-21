import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class StorageService {
  /**
   * Upload a single file to AWS S3 (Simulated with dummy logic, easily replaceable with @aws-sdk/client-s3).
   *
   * @param file Express.Multer.File to upload
   * @param folder Destination S3 prefix/folder
   * @returns Generated S3/CloudFront object URL
   */
  async uploadFile(
    file: Express.Multer.File,
    folder = 'uploads',
  ): Promise<string> {
    const fileExt = file.originalname
      ? file.originalname.split('.').pop()
      : 'bin';
    const randomHash = crypto.randomBytes(12).toString('hex');
    const sanitizedFileName = (file.originalname || 'file')
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .toLowerCase();
    const key = `${folder}/${Date.now()}_${randomHash}_${sanitizedFileName}`;

    // Dummy S3 upload logic: simulates PutObjectCommand to AWS S3 bucket
    // In production, instantiate S3Client and run PutObjectCommand with file.buffer
    return `https://s3.eu-west-1.amazonaws.com/election-eye-storage/${key}`;
  }

  /**
   * Upload multiple files in parallel to AWS S3.
   *
   * @param files Array of Express.Multer.File
   * @param folder Destination S3 prefix/folder
   * @returns Array of generated S3 URLs
   */
  async uploadFiles(
    files: Express.Multer.File[],
    folder = 'uploads',
  ): Promise<string[]> {
    if (!files || files.length === 0) {
      return [];
    }
    return Promise.all(files.map((file) => this.uploadFile(file, folder)));
  }
}
