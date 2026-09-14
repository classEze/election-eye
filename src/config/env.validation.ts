import Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().default('development'),

  PORT: Joi.number(),

  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRES_IN: Joi.string(),

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
});
