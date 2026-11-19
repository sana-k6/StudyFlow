import {
  ApiResponse,
  User,
  UserProfileResponse,
  UserPreferencesUpdate,
  RegisterRequest,
  LoginRequest,
  Module,
  CreateModuleDto,
  Assignment,
  CreateAssignmentDto,
  UpdateAssignmentDto,
  Subtask,
  CalendarEvent,
  CreateCalendarEventDto,
  UpdateCalendarEventDto,
  NextActionResponse,
} from '@studyflow/shared/types.js';

const BASE_URL = '/api/v1';

export class ApiErrorResponse extends Error {
  code: string;
  details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiErrorResponse';
    this.code = code;
    this.details = details;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include', // Include HTTP-only cookie
  });

  const json: ApiResponse<T> = await response.json();

  if (!response.ok || json.error) {
    const code = json.error?.code || 'SERVER_ERROR';
    const message = json.error?.message || `Request failed with status ${response.status}`;
    throw new ApiErrorResponse(code, message, json.error?.details);
  }

  return json.data as T;
}

export interface AssignmentWithDetails extends Assignment {
  module_code?: string;
  module_name?: string;
  module_color?: string;
  subtasks: Subtask[];
}

export const apiClient = {
  // Auth
  register: (data: RegisterRequest) =>
    request<{ user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  login: (data: LoginRequest) =>
    request<{ user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  logout: () =>
    request<{ message: string }>('/auth/logout', {
      method: 'POST',
    }),

  // User Profile & Preferences
  getCurrentUser: () => request<UserProfileResponse>('/users/me'),

  updatePreferences: (prefs: UserPreferencesUpdate) =>
    request<User>('/users/me/preferences', {
      method: 'PATCH',
      body: JSON.stringify(prefs),
    }),

  // Modules
  getModules: () => request<Module[]>('/modules'),
  createModule: (data: CreateModuleDto) =>
    request<Module>('/modules', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteModule: (id: string) =>
    request<{ id: string; deleted: boolean }>(`/modules/${id}`, {
      method: 'DELETE',
    }),

  // Calendar
  getEvents: (start?: string, end?: string) => {
    const params = new URLSearchParams();
    if (start) params.append('start', start);
    if (end) params.append('end', end);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return request<CalendarEvent[]>(`/calendar/events${queryString}`);
  },

  importIcs: (ics_content: string) =>
    request<{ imported_count: number; message: string }>('/calendar/import-ics', {
      method: 'POST',
      body: JSON.stringify({ ics_content }),
    }),

  createEvent: (data: CreateCalendarEventDto) =>
    request<CalendarEvent>('/calendar/events', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateEvent: (id: string, data: UpdateCalendarEventDto) =>
    request<CalendarEvent>(`/calendar/events/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteEvent: (id: string) =>
    request<{ id: string; deleted: boolean }>(`/calendar/events/${id}`, {
      method: 'DELETE',
    }),

  // Assignments & Subtasks
  getAssignments: () => request<AssignmentWithDetails[]>('/assignments'),

  createAssignment: (data: CreateAssignmentDto) =>
    request<Assignment>('/assignments', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateAssignment: (id: string, data: UpdateAssignmentDto) =>
    request<Assignment>(`/assignments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteAssignment: (id: string) =>
    request<{ id: string; deleted: boolean }>(`/assignments/${id}`, {
      method: 'DELETE',
    }),

  createSubtask: (assignmentId: string, title: string, estimated_mins: number = 45) =>
    request<Subtask>(`/assignments/${assignmentId}/subtasks`, {
      method: 'POST',
      body: JSON.stringify({ title, estimated_mins }),
    }),

  updateSubtask: (id: string, updates: Partial<Subtask>) =>
    request<Subtask>(`/subtasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  deleteSubtask: (id: string) =>
    request<{ id: string; deleted: boolean }>(`/subtasks/${id}`, {
      method: 'DELETE',
    }),

  // Next-Action & Tasks
  getNextAction: () => request<NextActionResponse>('/tasks/next-action'),
};
