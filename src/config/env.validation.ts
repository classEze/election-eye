import Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().default('development'),

  PORT: Joi.number(),

  JWT_SECRET: Joi.string().required(),

  REDIS_URI: Joi.string().uri(),

  MAILTRAP_HOST: Joi.string().required(),
  MAILTRAP_PORT: Joi.number(),
  MAILTRAP_UNAME: Joi.string().required(),
  MAILTRAP_PASS: Joi.string().required(),
  MAIL_FROM: Joi.string().required(),

  TERMII_API_KEY: Joi.string().optional(),
  TERMII_BASE_URL: Joi.string().uri().optional(),
  TERMII_SENDER_ID: Joi.string().optional(),

  HTTP_TIMEOUT: Joi.number().optional(),

  STORAGE_PROVIDER: Joi.string().valid('CLOUDFLARE_R2', 'AWS_S3').default('CLOUDFLARE_R2'),
  R2_ACCESS_KEY_ID: Joi.string().required(),
  R2_SECRET_ACCESS_KEY: Joi.string().required(),
  R2_ENDPOINT_URL: Joi.string().uri().required(),
  R2_BUCKET_NAME: Joi.string().required(),
});
