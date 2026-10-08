import Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().default('development'),

  PORT: Joi.number(),

  JWT_SECRET: Joi.string().required(),

  REDIS_URI: Joi.string().uri(),

  MAIL_HOST: Joi.string().optional().default('sandbox.smtp.mailtrap.io'),
  MAIL_PORT: Joi.number().optional().default(2525),
  MAIL_UNAME: Joi.string().optional(),
  MAIL_PASS: Joi.string().optional(),
  MAILTRAP_HOST: Joi.string().optional(),
  MAILTRAP_PORT: Joi.number().optional(),
  MAILTRAP_UNAME: Joi.string().optional(),
  MAILTRAP_PASS: Joi.string().optional(),
  MAIL_FROM: Joi.string().required(),
  RESEND_API_KEY: Joi.string().optional(),

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
