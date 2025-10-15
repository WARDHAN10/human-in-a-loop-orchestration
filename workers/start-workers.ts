// workers/start-workers.ts
import './approval-worker';
import './notification-worker';

console.log('🚀 BullMQ Workers Started');
console.log('📊 Approval Worker: Processing approval decisions');
console.log('📨 Notification Worker: Sending notifications');
console.log('⏳ Workers are now listening for jobs...');

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Shutting down workers gracefully...');
  process.exit(0);
});