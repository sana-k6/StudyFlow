export type SubscriptionTier = 'FREE' | 'PRO';

export type EventType = 'LECTURE' | 'TUTORIAL' | 'EXAM' | 'PERSONAL' | 'AI_STUDY_BLOCK';

export type AssignmentStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

export type AiFeatureType = 'BREAKDOWN' | 'SCHEDULE_GEN';

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiResponse<T = unknown> {
  data: T | null;
  error: ApiError | null;
  meta: Record<string, unknown>;
}

// User Models & DTOs
export interface User {
  id: string;
  email: string;
  full_name: string;
  university?: string | null;
  subscription_tier: SubscriptionTier;
  daily_study_cap_mins: number;
  preferred_study_start: string; // e.g. "09:00"
  preferred_study_end: string;   // e.g. "21:00"
  created_at: string;
}

export interface UserProfileResponse extends User {
  ai_breakdown_count_month?: number;
}

export interface UserPreferencesUpdate {
  university?: string | null;
  daily_study_cap_mins?: number;
  preferred_study_start?: string;
  preferred_study_end?: string;
}

// Module Models & DTOs
export interface Module {
  id: string;
  user_id: string;
  code: string;
  name: string;
  color_hex: string;
  credits?: number | null;
  semester?: string | null;
}

export interface CreateModuleDto {
  code: string;
  name: string;
  color_hex?: string;
  credits?: number | null;
  semester?: string | null;
}

// Assignment Models & DTOs
export interface Assignment {
  id: string;
  user_id: string;
  module_id: string;
  title: string;
  description?: string | null;
  due_date: string;
  weight_percentage: number;
  estimated_total_mins: number;
  priority_score: number;
  status: AssignmentStatus;
}

export interface CreateAssignmentDto {
  module_id: string;
  title: string;
  description?: string;
  due_date: string;
  weight_percentage?: number;
  estimated_total_mins?: number;
}

export interface UpdateAssignmentDto {
  title?: string;
  description?: string;
  due_date?: string;
  weight_percentage?: number;
  estimated_total_mins?: number;
  status?: AssignmentStatus;
}

// Subtask Models & DTOs
export interface Subtask {
  id: string;
  assignment_id: string;
  title: string;
  order_index: number;
  estimated_mins: number;
  completed_mins: number;
  is_completed: boolean;
  ai_generated: boolean;
}

export interface CreateSubtaskDto {
  assignment_id: string;
  title: string;
  order_index: number;
  estimated_mins?: number;
}

export interface UpdateSubtaskDto {
  title?: string;
  order_index?: number;
  estimated_mins?: number;
  completed_mins?: number;
  is_completed?: boolean;
}

// Calendar Events Models & DTOs
export interface CalendarEvent {
  id: string;
  user_id: string;
  module_id?: string | null;
  subtask_id?: string | null;
  external_uid?: string | null;
  title: string;
  event_type: EventType;
  start_time: string;
  end_time: string;
  is_fixed: boolean;
}

export interface CreateCalendarEventDto {
  module_id?: string | null;
  subtask_id?: string | null;
  title: string;
  event_type: EventType;
  start_time: string;
  end_time: string;
  is_fixed?: boolean;
}

export interface UpdateCalendarEventDto {
  module_id?: string | null;
  subtask_id?: string | null;
  title?: string;
  event_type?: EventType;
  start_time?: string;
  end_time?: string;
  is_fixed?: boolean;
}

// Study Logs
export interface StudyLog {
  id: string;
  user_id: string;
  subtask_id?: string | null;
  module_id: string;
  duration_mins: number;
  focus_rating?: number | null;
  logged_at: string;
}

// AI Usage Logs
export interface AiUsageLog {
  id: string;
  user_id: string;
  feature_type: AiFeatureType;
  tokens_used: number;
  created_at: string;
}

// Auth Requests & Responses
export interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
  university?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponseData {
  user: User;
}

// Prioritization & Scheduling DTOs
export interface NextActionResponse {
  subtask: Subtask | null;
  assignment?: Assignment | null;
  module?: Module | null;
  urgency_score: number;
  rationale: string;
}

export interface TimeSlot {
  slot_id: string;
  start_time: string;
  end_time: string;
  duration_mins: number;
}

export interface ScheduleGenerationResult {
  assigned_blocks: Array<{
    slot_id: string;
    subtask_id: string;
    start_time: string;
    end_time: string;
    title: string;
  }>;
  next_action_rationale: string;
}

// Analytics DTOs
export interface AnalyticsSummary {
  total_study_mins: number;
  hours_by_module: Array<{
    module_id: string;
    module_code: string;
    module_name: string;
    color_hex: string;
    duration_mins: number;
  }>;
  completion_velocity: {
    completed_subtasks: number;
    total_subtasks: number;
    completion_rate: number;
  };
  at_risk_deadlines: Array<{
    assignment_id: string;
    title: string;
    due_date: string;
    remaining_mins: number;
    days_left: number;
  }>;
}
