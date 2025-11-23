import mongoose, { Schema, Document } from 'mongoose';
import { CallTaskStatus } from '../../types';

export interface ICallLogDocument extends Document {
  call_task_id: number;
  lead_id: number;
  agent_id: number;
  status: CallTaskStatus;
  notes?: string;
  outcome?: string;
  duration_seconds?: number;
  recording_url?: string;
  metadata: {
    ip_address?: string;
    user_agent?: string;
    device?: string;
  };
  created_at: Date;
}

const CallLogSchema = new Schema(
  {
    call_task_id: { type: Number, required: true, index: true },
    lead_id: { type: Number, required: true, index: true },
    agent_id: { type: Number, required: true, index: true },
    status: {
      type: String,
      enum: ['pending', 'completed', 'missed'],
      required: true,
      index: true
    },
    notes: { type: String },
    outcome: { type: String },
    duration_seconds: { type: Number },
    recording_url: { type: String },
    metadata: {
      scheduled_at: { type: Date },
      completed_at: { type: Date },
      ip_address: { type: String },
      user_agent: { type: String }
    },
    created_at: { type: Date, default: Date.now, index: true }
  },
  {
    collection: 'call_logs',
    timestamps: false
  }
);

// Indexes for performance
CallLogSchema.index({ agent_id: 1, created_at: -1 });
CallLogSchema.index({ lead_id: 1, created_at: -1 });
CallLogSchema.index({ status: 1, created_at: -1 });

export const CallLog = mongoose.model('CallLog', CallLogSchema);