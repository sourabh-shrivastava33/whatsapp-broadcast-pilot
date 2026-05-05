import { Queue } from 'bullmq';
import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
export const connection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  // Required for cloud Redis like Upstash
  tls: REDIS_URL.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined
});

export const broadcastQueue = new Queue('broadcast-queue', {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

export const incomingMessageQueue = new Queue('incoming-message-queue', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});
