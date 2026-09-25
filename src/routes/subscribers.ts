import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/async-handler';
import { conflict } from '../lib/http-error';
import { prisma } from '../lib/prisma';
import { validateBody } from '../lib/validate';

const createSubscriberSchema = z.object({
  email: z.email(),
});

export const subscribersRouter = Router();

subscribersRouter.post(
  '/',
  validateBody(createSubscriberSchema),
  asyncHandler(async (req, res) => {
    try {
      const subscriber = await prisma.subscriber.create({ data: req.body });
      res.status(201).json(subscriber);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw conflict('Email is already subscribed');
      }
      throw error;
    }
  }),
);

subscribersRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const subscribers = await prisma.subscriber.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(subscribers);
  }),
);
