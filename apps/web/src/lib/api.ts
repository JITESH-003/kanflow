const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const ACCESS_KEY = 'kanflow.access';
const REFRESH_KEY = 'kanflow.refresh';

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  createdAt: string;
}

export interface AuthResponse {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

export const tokenStore = {
  get access(): string | null {
    return typeof window === 'undefined' ? null : localStorage.getItem(ACCESS_KEY);
  },
  get refresh(): string | null {
    return typeof window === 'undefined' ? null : localStorage.getItem(REFRESH_KEY);
  },
  set(tokens: { accessToken: string; refreshToken: string }) {
    localStorage.setItem(ACCESS_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  withAuth = false,
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (withAuth && tokenStore.access) {
    headers.set('Authorization', `Bearer ${tokenStore.access}`);
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = (await res.json()) as { message?: string | string[] };
      if (Array.isArray(body.message)) message = body.message.join(', ');
      else if (body.message) message = body.message;
    } catch {
      message = res.statusText;
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const authApi = {
  register(data: { name: string; email: string; password: string }) {
    return request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  login(data: { email: string; password: string }) {
    return request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  me() {
    return request<PublicUser>('/auth/me', { method: 'GET' }, true);
  },
};

export interface TeamSummary {
  id: string;
  name: string;
  workspaceId: string;
  role: string;
  memberCount: number;
  createdAt: string;
}

export interface TeamMemberView {
  id: string;
  role: string;
  userId: string;
  teamId: string;
  createdAt: string;
  user: { id: string; name: string; email: string; avatarUrl: string | null };
}

export interface TeamDetail {
  id: string;
  name: string;
  workspaceId: string;
  createdAt: string;
  members: TeamMemberView[];
}

export const teamsApi = {
  list: () => request<TeamSummary[]>('/teams', { method: 'GET' }, true),
  create: (name: string) =>
    request<{ id: string; name: string }>(
      '/teams',
      { method: 'POST', body: JSON.stringify({ name }) },
      true,
    ),
  get: (id: string) => request<TeamDetail>(`/teams/${id}`, { method: 'GET' }, true),
  addMember: (id: string, email: string, role: string) =>
    request<TeamMemberView>(
      `/teams/${id}/members`,
      { method: 'POST', body: JSON.stringify({ email, role }) },
      true,
    ),
};

export interface WorkflowStageView {
  id: string;
  workflowId: string;
  name: string;
  slug: string;
  position: number;
  isInitial: boolean;
}

export interface WorkflowRuleView {
  id: string;
  workflowId: string;
  type: string;
  config: { field?: string; lockedFromPosition?: number } & Record<string, unknown>;
}

export interface WorkflowView {
  id: string;
  teamId: string;
  name: string;
  stages: WorkflowStageView[];
  rules: WorkflowRuleView[];
}

export interface WorkflowStageInput {
  id?: string;
  name: string;
  slug: string;
  position: number;
  isInitial: boolean;
}

export interface WorkflowRuleInput {
  id?: string;
  type: string;
  config: Record<string, unknown>;
}

export const workflowApi = {
  get: (teamId: string) =>
    request<WorkflowView>(`/teams/${teamId}/workflow`, { method: 'GET' }, true),
  update: (
    teamId: string,
    payload: { name?: string; stages: WorkflowStageInput[]; rules: WorkflowRuleInput[] },
  ) =>
    request<WorkflowView>(
      `/teams/${teamId}/workflow`,
      { method: 'PUT', body: JSON.stringify(payload) },
      true,
    ),
};
