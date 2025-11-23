import { SNSClient, PublishCommand, PublishCommandOutput } from '@aws-sdk/client-sns';
import { snsClient, AWS_CONFIG } from '../config/aws';
import { NotificationLog } from '../models/mongodb/NotificationLog';
import logger from '../utils/logger';

type MessageAttributesInput = Record<string, string>;

type PublishResult =
  | { success: true; messageId?: string | undefined }
  | { success: false; error: string };

/**
 * SNS helper service
 */
export class SNSService {
  /**
   * Publish notification to SNS topic
   * @param message message body
   * @param subject message subject
   * @param attributes optional flat string attributes
   */
  static async publishNotification(
    message: string,
    subject: string,
    attributes?: MessageAttributesInput
  ): Promise<PublishResult> {
    // Create notification log (persist pending)
    const logDoc = await NotificationLog.create({
      type: 'sns',
      recipient: AWS_CONFIG.SNS_TOPIC_ARN,
      message,
      status: 'pending',
      retry_count: 0,
      created_at: new Date()
    });

    try {
      const command = new PublishCommand({
        TopicArn: AWS_CONFIG.SNS_TOPIC_ARN,
        Message: message,
        Subject: subject,
        MessageAttributes: attributes ? this.buildMessageAttributes(attributes) : undefined
      });

      const response: PublishCommandOutput = await (snsClient as SNSClient).send(command);

      // Update log as sent
      await NotificationLog.updateOne(
        { _id: logDoc._id },
        {
          $set: {
            status: 'sent',
            provider_response: { MessageId: response.MessageId },
            sent_at: new Date()
          }
        }
      ).exec?.();

      logger.info(`SNS notification sent: ${response.MessageId ?? 'unknown-id'}`);

      return { success: true, messageId: response.MessageId };
    } catch (err: any) {
      const messageText = err?.message ?? String(err);

      // Update log as failed, increment retry_count
      await NotificationLog.updateOne(
        { _id: logDoc._id },
        {
          $set: { status: 'failed', error: messageText, failed_at: new Date() },
          $inc: { retry_count: 1 }
        }
      ).exec?.();

      logger.error('SNS notification failed', { error: messageText, topic: AWS_CONFIG.SNS_TOPIC_ARN });

      return { success: false, error: messageText };
    }
  }

  /**
   * Publish task assignment notification
   */
  static async notifyTaskAssignment(data: {
    taskId: number;
    leadName: string;
    agentEmail: string;
    agentPhone?: string;
  }): Promise<void> {
    const messageLines = [
      'New call task assigned!',
      '',
      `Task ID: ${data.taskId}`,
      `Lead: ${data.leadName}`,
      `Agent Email: ${data.agentEmail}`
    ];
    if (data.agentPhone) messageLines.push(`Agent Phone: ${data.agentPhone}`);

    const message = messageLines.join('\n');
    const subject = 'New Call Task Assigned';
    const attributes: MessageAttributesInput = {
      task_id: String(data.taskId),
      event_type: 'task_assignment',
      agent_email: data.agentEmail
    };

    await this.publishNotification(message, subject, attributes);
  }

  /**
   * Publish task completion notification
   */
  static async notifyTaskCompletion(data: {
    taskId: number;
    leadName: string;
    outcome: string;
    agentEmail: string;
  }): Promise<void> {
    const message = [
      'Call task completed!',
      '',
      `Task ID: ${data.taskId}`,
      `Lead: ${data.leadName}`,
      `Outcome: ${data.outcome}`,
      `Agent: ${data.agentEmail}`
    ].join('\n');

    const subject = 'Call Task Completed';
    const attributes: MessageAttributesInput = {
      task_id: String(data.taskId),
      event_type: 'task_completion',
      outcome: data.outcome
    };

    await this.publishNotification(message, subject, attributes);
  }

  /**
   * Build SNS message attributes from a flat string record
   */
  private static buildMessageAttributes(attributes: MessageAttributesInput) {
    // SNS expects MessageAttributes as a map of { DataType, StringValue }
    const messageAttributes: Record<string, { DataType: 'String'; StringValue: string }> = {};
    for (const [key, value] of Object.entries(attributes)) {
      // sanitize keys and values if necessary
      messageAttributes[key] = {
        DataType: 'String',
        StringValue: String(value)
      };
    }
    return messageAttributes;
  }
}
