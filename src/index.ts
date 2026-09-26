import cors from 'cors';
import dotenv from 'dotenv';
import express, {
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import { redactSecrets } from './lib/database-url';
import { HttpError } from './lib/http-error';
import { prisma } from './lib/prisma';
import { adminRouter } from './routes/admin';
import { healthRouter } from './routes/health';
import { storiesRouter } from './routes/stories';

dotenv.config({ override: true });

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:3022',
  }),
);
app.use(express.json());

app.use('/api/health', healthRouter);
app.use('/api/admin', adminRouter);
app.use('/api/stories', storiesRouter);

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({ message: error.message });
    return;
  }

  console.error(redactSecrets(error instanceof Error ? error.stack ?? error.message : String(error)));
  res.status(500).json({ message: 'Internal server error' });
});

const port = Number(process.env.PORT ?? 3023);
const host = '0.0.0.0';

async function start() {
  try {
    await prisma.$connect();
  } catch (error) {
    console.error(redactSecrets(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }

  app.listen(port, host, () => {
    console.log(`API listening on http://${host}:${port}`);
  });
}

void start();
