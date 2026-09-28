import compression from 'compression';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { env, errorMessage } from './lib/env';
import { HttpError } from './lib/http-error';
import { prisma } from './lib/prisma';
import { adminRouter } from './routes/admin';
import { healthRouter } from './routes/health';
import { storiesRouter } from './routes/stories';

const app = express();

// Traefik terminates TLS in front of the API, so trust its forwarded headers.
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(compression());
app.use(cors({ origin: env.frontendOrigins }));
app.use(express.json({ limit: '1mb' }));

app.use('/api/health', healthRouter);
app.use('/api/stories', storiesRouter);
app.use('/api/admin', adminRouter);

app.use((_req, res) => {
  res.status(404).json({ message: 'Not found' });
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({ message: error.message });
    return;
  }

  console.error(errorMessage(error));
  res.status(500).json({ message: 'Internal server error' });
});

const server = app.listen(env.port, '0.0.0.0', () => {
  console.log(`API listening on http://0.0.0.0:${env.port}`);
});

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    server.close(() => {
      void prisma.$disconnect().finally(() => process.exit(0));
    });
  });
}
