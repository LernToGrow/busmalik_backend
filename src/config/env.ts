import dotenv from 'dotenv';
dotenv.config();

export const env = {
  PORT: process.env.PORT || '5000',
  MONGO_URI: process.env.MONGO_URI || 'mongodb://localhost:27017/routehq',
  JWT_SECRET: process.env.JWT_SECRET || 'routehq_secret',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  MSG91_AUTH_KEY: process.env.MSG91_AUTH_KEY || '',
};
