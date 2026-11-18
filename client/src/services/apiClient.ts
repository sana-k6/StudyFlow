import { ApiResponse, User, UserProfileResponse, UserPreferencesUpdate, RegisterRequest, LoginRequest } from '@studyflow/shared/types.js';

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

export const apiClient = {
  // Auth
  register: (data: RegisterRequest) => request<{ user: User }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  login: (data: LoginRequest) => request<{ user: User }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  logout: () => request<{ message: string }>('/auth/logout', {
    method: 'POST',
  }),

  // User Profile & Preferences
  getCurrentUser: () => request<UserProfileResponse>('/users/me'),

  updatePreferences: (prefs: UserPreferencesUpdate) => request<User>('/users/me/preferences', {
    method: 'PATCH',
    body: JSON.stringify(prefs),
  }),
};
