import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: Number(process.env.PORT || 5000),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  mongoUri: process.env.MONGODB_URI || '',
  jwtSecret: process.env.JWT_SECRET || '',
  rapidApiKey: process.env.RAPIDAPI_KEY || '',
  rapidApiHost: process.env.RAPIDAPI_HOST || '',
  rapidApiBaseUrl: process.env.RAPIDAPI_BASE_URL || '',
  firecrawlApiKey: process.env.FIRECRAWL_API_KEY || ''
};

export function assertAuthConfigured() {
  if (!config.jwtSecret) throw new Error('JWT_SECRET is required');
}
