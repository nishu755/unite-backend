import mongoose, { Schema, Document } from 'mongoose';

export interface INotificationLogDocument extends Document {
  type: 'sms' | 'sns' | 'email';
  recipient: string;
  message: string;
  status: 'pending' | 'sent' | 'failed' | 'delivered';
  provider_response?: Record<string, any>;
  error?: string;
  call_task_id?: number;
  lead_id?: number;
  agent_id?: number;
  retry_count: number;
  sent_at?: Date;
  created_at: Date;
}

const NotificationLogSchema = new Schema<INotificationLogDocument>(
  {
    type: {
      type: String,
      enum: ['sms', 'sns', 'email'],
      required: true,
      index: true
    },
    recipient: {
      type: String,
      required: true
    },
    message: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'sent', 'failed', 'delivered'],
      default: 'pending',
      index: true
    },
    provider_response: {
      type: Schema.Types.Mixed
    },
    error: {
      type: String
    },
    call_task_id: {
      type: Number,
      index: true
    },
    lead_id: {
      type: Number,
      index: true
    },
    agent_id: {
      type: Number,
      index: true
    },
    retry_count: {
      type: Number,
      default: 0
    },
    sent_at: {
      type: Date
    },
    created_at: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    collection: 'notification_logs',
    timestamps: false
  }
);

// Indexes
NotificationLogSchema.index({ status: 1, created_at: -1 });
NotificationLogSchema.index({ agent_id: 1, created_at: -1 });

export const NotificationLog = mongoose.model<INotificationLogDocument>(
  'NotificationLog',
  NotificationLogSchema
);