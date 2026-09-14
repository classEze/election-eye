export default () => ({
  app: {
    port: parseInt(process.env.PORT ?? '5500', 10),
    environment: process.env.NODE_ENV ?? 'development',
    client: 'client',
    admin: 'admin',
  },

  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN,
  },

  mail: {
    host: process.env.MAILTRAP_HOST,
    port: parseInt(process.env.MAILTRAP_PORT ?? '2525', 10),
    username: process.env.MAILTRAP_UNAME,
    password: process.env.MAILTRAP_PASS,
    from: process.env.MAIL_FROM ?? '"No Reply" <noreply@election-eye.com>',
  },
  termii: {
    apiKey: process.env.TERMII_API_KEY,
    baseUrl: process.env.TERMII_BASE_URL,
    senderId: process.env.TERMII_SENDER_ID,
  },

  database: {
    user: process.env.DATABASE_USER ?? 'username',
    password: process.env.DATABASE_PASSWORD ?? 'password',
    host: process.env.DATABASE_HOST ?? 'localhost',
    name: process.env.DATABASE_NAME ?? 'election-eye',
  },

  redis: {
    uri: process.env.REDIS_URI || 'redis://localhost:6379',
  },
  http: {
    timeout: process.env.HTTP_TIMEOUT ?? 10000,
  },
});
