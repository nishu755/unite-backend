import { Request } from 'express';

export enum UserRole {
    ADMIN = 'admin',
    MANAGER = 'manager',
    AGENT = 'agent'
}

export enum LeadStatus {
    NEW = 'new',
    CONTACTED = 'contacted',
    QUALIFIED = 'qualified',
    CONVERTED = 'converted'
}

export enum CallTaskStatus {
    PENDING = 'pending',
    COMPLETED = 'completed',
    MISSED = 'missed'
}

export interface IUser {
    id: number;
    email: string;
    password_hash: string;
    role: UserRole;
    phone?: string;
    is_active?: boolean;
    created_at: Date;
    updated_at: Date;
}

export interface CreateUserInput {
    email: string;
    password: string;
    role: UserRole;
    phone?: string;
}

export interface UpdateUserInput {
    email?: string;
    phone?: string;
    role?: UserRole;
}

export type SafeUser = Omit<IUser, 'password_hash'>;

export interface ILead {
    id: number;
    name: string;
    phone: string;
    email?: string;
    status: LeadStatus;
    source?: string;
    assigned_to?: number;
    image_url?: string;
    created_at: Date;
    updated_at: Date;
}

export interface ICallTask {
    id: number;
    lead_id: number;
    agent_id: number;
    status: CallTaskStatus;
    notes?: string;
    outcome?: string;
    scheduled_at?: Date;
    completed_at?: Date;
    idempotency_key: string;
    created_at: Date;
    updated_at: Date;
}

export interface AuthRequest extends Request {
    file: any;
    user?: {
        id: number;
        email: string;
        role: UserRole;
    };
    correlationId?: string;
}

export interface JWTPayload {
    id: number;
    email: string;
    role: UserRole;
}

export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
    correlationId?: string;
}

export interface PaginationParams {
    page: number;
    limit: number;
    offset: number;
}

export interface LeadFilters {
    status?: LeadStatus;
    source?: string;
    assigned_to?: number;
}

export interface CreateLeadInput {
    name: string;
    phone: string;
    email?: string;
    status?: LeadStatus;
    source?: string;
    assigned_to?: number;
    image_url?: string;
}

export interface UpdateLeadInput {
    name?: string;
    phone?: string;
    email?: string;
    status?: LeadStatus;
    source?: string;
    assigned_to?: number;
    image_url?: string;
}

export interface CsvLeadRow {
    name: string;
    phone: string;
    email?: string;
    source?: string;
}
export interface DailyTaskSummary {
    date: string;
    total_calls: number;
    completed: number;
    missed: number;
    agent_id: number;
}


export interface AgentStats {
    agent_id: number;
    email: string;
    total_calls: number;
    completed: number;
    missed: number;
    completion_percentage: number;
}

export interface AgentTaskStats {
    total_calls: number;
    completed: number;
    missed: number;
    pending: number;
    completion_percentage?: number;
}

export interface OverallTaskStats {
    total_calls: number;
    completed: number;
    missed: number;
    pending: number;
    total_agents: number;
    total_leads: number;
}

export interface BusiestAgent {
    agent_id: number;
    total_tasks: number;
    completed: number;
    missed: number;
}

export interface CreateCallTaskInput {
    lead_id: number;
    agent_id: number;
    scheduled_at?: Date;
    idempotency_key?: string;
}

export interface CompleteCallTaskInput {
    notes: string;
    outcome: string;
}

export interface DailySummary {
    date: string;
    total_calls: number;
    completed: number;
    missed: number;
    completion_percentage: number;
    per_agent: AgentStats[];
    busiest_agent?: {
        agent_id: number;
        email: string;
        total_calls: number;
    };
}

export interface JWTTokenPayload {
    id: number;
    email: string;
    role: UserRole;
}

export interface JWTPayload extends JWTTokenPayload {
    iat?: number;
    exp?: number;
}


export interface TwilioMessageResponse {
    sid: string;
    status?: string;
    to?: string;
    from?: string;
    [key: string]: any;
}

export interface INotificationLog {
    _id?: any;
    type: 'sms' | 'email' | 'sns' | string;
    recipient: string;
    message: string;
    status: 'pending' | 'sent' | 'failed' | string;
    retry_count?: number;
    call_task_id?: number;
    lead_id?: number;
    agent_id?: number;
    created_at?: Date;
    sent_at?: Date;
    failed_at?: Date;
    [key: string]: any;
}

export type SendSMSResult =
    | { success: true; messageId?: string }
    | { success: false; error: string };
