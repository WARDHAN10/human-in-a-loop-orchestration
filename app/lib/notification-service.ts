// lib/notification-service.ts
import { notificationQueue } from "./queue";

export class NotificationService {
  async sendApprovalNotification(approval: any, workflow: any, step: any) {
    try {
      await notificationQueue.add(
        `notification-${approval.id}`,
        { approval, workflow, step },
        {
          jobId: `notification-${approval.id}`, // Prevent duplicates
          delay: 100, // Small delay to ensure approval is created
        }
      );

      console.log(`📨 Notification queued: notification-${approval.id}`);
      return { success: true, queued: true, jobId: `notification-${approval.id}` };

    } catch (error) {
      console.error(`❌ Failed to queue notification for approval ${approval.id}:`, error);
      throw error;
    }
  }
}