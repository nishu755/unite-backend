import CircuitBreaker from 'opossum';
import { twilioClient, TWILIO_CONFIG } from '../config/twilio';
import { NotificationLog } from '../models/mongodb/NotificationLog';
import logger from '../utils/logger';
import { INotificationLog, SendSMSResult, TwilioMessageResponse } from '../types';


export class TwilioService {
    private static circuitBreaker: CircuitBreaker | null = null;


    private static getCircuitBreaker(): CircuitBreaker {
        if (!this.circuitBreaker) {

            this.circuitBreaker = new CircuitBreaker(

                this.sendSMSInternal.bind(this),
                {
                    timeout: 10000,
                    errorThresholdPercentage: 50,
                    resetTimeout: 30000 // 30s
                }
            );

            this.circuitBreaker.on('open', () => {
                logger.warn('Twilio circuit breaker opened');
            });
            this.circuitBreaker.on('halfOpen', () => {
                logger.info('Twilio circuit breaker half-open');
            });
            this.circuitBreaker.on('close', () => {
                logger.info('Twilio circuit breaker closed');
            });
            this.circuitBreaker.on('fallback', () => {
                logger.warn('Twilio circuit breaker fallback invoked');
            });
        }

        return this.circuitBreaker;
    }


    static async sendSMS(
        to: string,
        message: string,
        metadata?: {
            call_task_id?: number;
            lead_id?: number;
            agent_id?: number;
        }
    ): Promise<SendSMSResult> {

        if (!twilioClient) {
            logger.warn('Twilio not configured, skipping SMS');
            return { success: false, error: 'Twilio not configured' };
        }


        if (!this.isValidPhoneNumber(to)) {
            logger.error(`Invalid phone number: ${to}`);
            return { success: false, error: 'Invalid phone number format' };
        }

        const logPayload: INotificationLog = {
            type: 'sms',
            recipient: to,
            message,
            status: 'pending',
            retry_count: 0,
            ...metadata,
            created_at: new Date()
        };

        const logDoc = (await NotificationLog.create(logPayload)) as INotificationLog;

        try {
            const breaker = this.getCircuitBreaker();


            const result = (await breaker.fire(to, message)) as TwilioMessageResponse;


            await NotificationLog.updateOne(
                { _id: logDoc._id },
                {
                    $set: {
                        status: 'sent',
                        provider_response: {
                            sid: result.sid,
                            status: result.status,
                            to: result.to,
                            from: result.from
                        },
                        sent_at: new Date()
                    }
                }
            ).exec?.();

            logger.info(`SMS sent successfully to ${to}`, { sid: result.sid });

            return { success: true, messageId: result.sid };
        } catch (err: any) {
            const errorMessage = err?.message ?? String(err);


            await NotificationLog.updateOne(
                { _id: logDoc._id },
                {
                    $set: { status: 'failed', error: errorMessage, failed_at: new Date() },
                    $inc: { retry_count: 1 }
                }
            ).exec?.();

            logger.error('SMS send failed', { error: errorMessage, to });

            return { success: false, error: errorMessage };
        }
    }


    private static async sendSMSInternal(to: string, message: string): Promise<TwilioMessageResponse> {
        if (!twilioClient) {
            throw new Error('Twilio client not initialized');
        }


        const response = (await twilioClient.messages.create({
            body: message,
            from: TWILIO_CONFIG.PHONE_NUMBER,
            to
        })) as TwilioMessageResponse;

        return response;
    }


    static async sendTaskAssignmentSMS(data: {
        agentPhone: string;
        agentName: string;
        leadName: string;
        taskId: number;
        leadId?: number;
        agentId?: number;
    }): Promise<void> {
        const message = `Hi ${data.agentName}, you have a new call task!\n\nLead: ${data.leadName}\nTask ID: ${data.taskId}\n\nPlease check your dashboard.`;


        await this.sendSMS(data.agentPhone, message, {
            call_task_id: data.taskId,
            lead_id: data.leadId,
            agent_id: data.agentId
        });
    }


    static async sendTaskReminderSMS(data: {
        agentPhone: string;
        agentName: string;
        pendingTasksCount: number;
        agentId?: number;
    }): Promise<void> {
        const message = `Hi ${data.agentName}, you have ${data.pendingTasksCount} pending call task(s). Please complete them soon.`;

        await this.sendSMS(data.agentPhone, message, { agent_id: data.agentId });
    }


    static async retryFailedMessages(maxRetries: number = 3): Promise<number> {
        const failedLogs = await NotificationLog.find({
            type: 'sms',
            status: 'failed',
            retry_count: { $lt: maxRetries }
        })
            .limit(50)
            .lean()
            .exec();

        let successCount = 0;

        for (const log of failedLogs as INotificationLog[]) {
            try {
                const res = await this.sendSMS(log.recipient, log.message, {
                    call_task_id: log.call_task_id,
                    lead_id: log.lead_id,
                    agent_id: log.agent_id
                });

                if (res.success) successCount++;
            } catch (error) {
                logger.error(`Failed to retry SMS for log ${log._id}:`, error);
            }
        }

        logger.info(`Retried ${successCount} failed SMS messages`);
        return successCount;
    }


    private static isValidPhoneNumber(phone: string): boolean {
        const phoneRegex = /^\+[1-9]\d{1,14}$/;
        return phoneRegex.test(phone);
    }


    static async checkMessageStatus(messageSid: string): Promise<string | null> {
        if (!twilioClient) {
            return null;
        }

        try {

            const message = (await (twilioClient as any).messages(messageSid).fetch()) as {
                status?: string;
            };

            return message?.status ?? null;
        } catch (err) {
            logger.error(`Failed to fetch message status for ${messageSid}:`, err);
            return null;
        }
    }
}
