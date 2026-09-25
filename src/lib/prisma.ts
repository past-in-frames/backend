import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { applyDatabaseUrl } from './database-url';

dotenv.config({ override: true });
applyDatabaseUrl();

export const prisma = new PrismaClient();
