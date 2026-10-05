import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { StorageService } from './storage.service';
import { Public } from '../decorators/public.decorator';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class StorageValidationWebhookDto {
  @IsNotEmpty()
  @IsString()
  fileKey!: string;

  @IsNotEmpty()
  @IsEnum(['image', 'video'], {
    message: 'expectedType must be either "image" or "video"',
  })
  expectedType!: 'image' | 'video';
}

@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  /**
   * Webhook endpoint triggered on upload or directly by client verification.
   * Validates file size (10MB for images, 50MB for videos) and binary magic bytes.
   */
  @Public()
  @Post('webhook/validate')
  @HttpCode(HttpStatus.OK)
  async validateWebhook(@Body() dto: StorageValidationWebhookDto) {
    if (!dto.fileKey || !dto.expectedType) {
      throw new BadRequestException('fileKey and expectedType are required');
    }

    const result = await this.storageService.validateMediaFile(
      dto.fileKey,
      dto.expectedType,
    );

    return {
      success: true,
      message: `Media file passed binary verification and size constraints (${(result.sizeBytes / (1024 * 1024)).toFixed(2)} MB).`,
      ...result,
    };
  }
}
