import { Schema, model, Document } from 'mongoose';

interface ICsvLog extends Document {
  file_name: string;
  s3_key: string;
  upload_user_id: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  total_rows: number;
  successful_imports: number;
  failed_imports: number;
  validation_errors?: Array<{ row: number; data: any; error: string }>;
  error_report?: string;
  processing_time_ms?: number;
  started_at?: Date;
  created_at: Date;
  completed_at?: Date;
}

const csvLogSchema = new Schema<ICsvLog>({
  file_name: { type: String, required: true },
  s3_key: { type: String, required: true },
  upload_user_id: { type: Number, required: true },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  total_rows: { type: Number, default: 0 },
  successful_imports: { type: Number, default: 0 },
  failed_imports: { type: Number, default: 0 },
  validation_errors: [
    {
      row: Number,
      data: Schema.Types.Mixed,
      error: String
    }
  ],
  error_report: { type: String },
  processing_time_ms: { type: Number },
  started_at: { type: Date },
  created_at: { type: Date, default: Date.now },
  completed_at: { type: Date }
});

export const CsvLog = model<ICsvLog>('CsvLog', csvLogSchema);