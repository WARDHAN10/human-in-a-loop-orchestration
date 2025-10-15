// workers/notification-worker.ts
import redis from '@/app/lib/redis';
import { WorkflowEngine } from '@/app/lib/workflow-engine';
import { Worker } from 'bullmq';

const engine = new WorkflowEngine()
export const notificationWorker = new Worker('notification-queue',
  async (job) => {
    const { approval, workflow, step } = job.data;
    
    console.log(`📢 Processing notification for approval: ${approval.id}`);

    await sendToMultipleChannels(approval, workflow, step);
    
    return { success: true, approvalId: approval.id, channels: getChannelsFromStep(step) };
  },
  { 
    connection: redis,
    concurrency: 10 // Process 10 notification jobs concurrently
  }
);

// Worker event handlers
notificationWorker.on('completed', (job) => {
  console.log(`✅ Notification job ${job.id} completed`);
});

notificationWorker.on('failed', (job, err) => {
  console.error(`❌ Notification job ${job?.id} failed:`, err);
});

// Helper functions
async function sendToMultipleChannels(approval: any, workflow: any, step: any) {
  const channels = getChannelsFromStep(step);
  
  console.log(`📢 Sending approval ${approval.id} via channels: ${channels.join(', ')}`);

  const promises = channels.map(channel => 
    sendToChannel(approval, workflow, step, channel)
  );

  const results = await Promise.allSettled(promises);
  
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      console.log(`✅ Sent to ${channels[index]}`);
    } else {
      console.error(`❌ Failed to send to ${channels[index]}:`, result.reason);
    }
  });
}

function getChannelsFromStep(step: any): string[] {
  const channels: string[] = [];
  
  if (step.config.email) channels.push('email');
  if (step.config.slack) channels.push('slack');
  if (step.config.sms) channels.push('sms');
  if (step.config.whatsapp) channels.push('whatsapp');
  
  return channels.length > 0 ? channels : ['email'];
}

async function sendToChannel(approval: any, workflow: any, step: any, channel: string) {
  const approvalUrl = `${process.env.BASE_URL}/approve/${approval.token}`;
    console.log('channel',channel)
  switch (channel) {
    case 'email':
      return engine.sendEmailApproval(approval, workflow, step);
    case 'slack':
      return sendSlack(approval, workflow, step, approvalUrl);
    case 'sms':
      return sendSMS(approval, workflow, step, approvalUrl);
    case 'whatsapp':
      return sendWhatsApp(approval, workflow, step, approvalUrl);
    default:
      throw new Error(`Unknown channel: ${channel}`);
  }
}

async function sendEmail(approval: any, workflow: any, step: any, approvalUrl: string) {
  console.log(`📧 Sending email to ${step.config.assignee}`);
  // Your email sending logic
}

async function sendSlack(approval: any, workflow: any, step: any, approvalUrl: string) {
  console.log(`💬 Sending Slack message`);
  // Your Slack sending logic
}

async function sendSMS(approval: any, workflow: any, step: any, approvalUrl: string) {
  console.log(`📱 Sending SMS`);
  // Your SMS sending logic
}

async function sendWhatsApp(approval: any, workflow: any, step: any, approvalUrl: string) {
  console.log(`💚 Sending WhatsApp`);
  // Your WhatsApp sending logic
}