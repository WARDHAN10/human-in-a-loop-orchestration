// lib/queue.ts
import { Queue, Worker } from 'bullmq';
import { redis } from './redis';

// Approval Queue
export const approvalQueue = new Queue('approval-queue', {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 100,    // Keep last 100 completed jobs
    removeOnFail: 50,         // Keep last 50 failed jobs  
    attempts: 3,              // Retry 3 times
    backoff: {
      type: 'exponential',    // Exponential backoff
      delay: 1000,            // 1s, 2s, 4s, etc.
    },
  },
});

// Notification Queue
export const notificationQueue = new Queue('notification-queue', {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 200,
    removeOnFail: 100,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  },
});