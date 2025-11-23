import mongoose, { Schema, Document } from 'mongoose';

export interface IApiLogDocument extends Document {
  correlation_id: string;
  method: string;
  path: string;
  user_id?: number;
  status_code: number;
  duration_ms: number;
  request_body?: Record<string, any>;
  response_body?: Record<string, any>;
  error?: string;
  ip_address?: string;
  user_agent?: string;
  timestamp: Date;
}

const ApiLogSchema = new Schema(
  {
    correlation_id: { 
      type: String, 
      required: true,
      index: true 
    },
    method: { 
      type: String, 
      required: true 
    },
    path: { 
      type: String, 
      required: true,
      index: true 
    },
    user_id: { 
      type: Number,
      index: true 
    },
    status_code: { 
      type: Number, 
      required: true,
      index: true 
    },
    duration_ms: { 
      type: Number, 
      required: true 
    },
    request_body: { 
      type: Schema.Types.Mixed 
    },
    response_body: { 
      type: Schema.Types.Mixed 
    },
    error: { 
      type: String 
    },
    ip_address: { 
      type: String 
    },
    user_agent: { 
      type: String 
    },
    timestamp: { 
      type: Date, 
      default: Date.now,
      index: true 
    }
  },
  {
    collection: 'api_logs',
    timestamps: false
  }
);

// Indexes 
ApiLogSchema.index({ timestamp: -1 });
ApiLogSchema.index({ user_id: 1, timestamp: -1 });
ApiLogSchema.index({ status_code: 1, timestamp: -1 });

// TTL index - automatically delete logs older than 90 days
ApiLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7776000 });

export const ApiLog = mongoose.model('ApiLog', ApiLogSchema);