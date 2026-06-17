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

export interface StageRef {
  id: string;
  name: string;
  slug: string;
  position: number;
  isInitial: boolean;
}

export interface UserRef {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

export interface AssigneeView {
  id: string;
  ticketId: string;
  userId: string;
  user: UserRef;
}

export interface CommentView {
  id: string;
  ticketId: string;
  body: string;
  createdAt: string;
  author: UserRef;
  attachments: AttachmentView[];
}

export interface ActivityView {
  id: string;
  action: string;
  payload: unknown;
  createdAt: string;
  actor: UserRef;
}

export interface TicketCard {
  id: string;
  teamId: string;
  title: string;
  description: string | null;
  priority: string;
  effort: number | null;
  etaAt: string | null;
  stageId: string;
  stage: StageRef;
  assignees: AssigneeView[];
  _count: { comments: number };
  createdAt: string;
  updatedAt: string;
}

export interface TicketDetail {
  id: string;
  teamId: string;
  title: string;
  description: string | null;
  priority: string;
  effort: number | null;
  etaAt: string | null;
  stageId: string;
  stage: StageRef;
  creator: UserRef;
  assignees: AssigneeView[];
  comments: CommentView[];
  attachments: AttachmentView[];
  activities: ActivityView[];
  createdAt: string;
  updatedAt: string;
}

export const ticketsApi = {
  list: (teamId: string) =>
    request<TicketCard[]>(`/teams/${teamId}/tickets`, { method: 'GET' }, true),
  create: (payload: {
    teamId: string;
    title: string;
    description?: string;
    priority?: string;
    assigneeIds?: string[];
  }) => request<TicketDetail>('/tickets', { method: 'POST', body: JSON.stringify(payload) }, true),
  get: (ticketId: string) =>
    request<TicketDetail>(`/tickets/${ticketId}`, { method: 'GET' }, true),
  update: (
    ticketId: string,
    payload: { title?: string; description?: string; priority?: string },
  ) =>
    request<TicketDetail>(
      `/tickets/${ticketId}`,
      { method: 'PATCH', body: JSON.stringify(payload) },
      true,
    ),
  move: (ticketId: string, stageId: string) =>
    request<TicketDetail>(
      `/tickets/${ticketId}/stage`,
      { method: 'PATCH', body: JSON.stringify({ stageId }) },
      true,
    ),
  addAssignee: (ticketId: string, userId: string) =>
    request<TicketDetail>(
      `/tickets/${ticketId}/assignees`,
      { method: 'POST', body: JSON.stringify({ userId }) },
      true,
    ),
  removeAssignee: (ticketId: string, userId: string) =>
    request<TicketDetail>(`/tickets/${ticketId}/assignees/${userId}`, { method: 'DELETE' }, true),
  addComment: (ticketId: string, body: string) =>
    request<CommentView>(
      `/tickets/${ticketId}/comments`,
      { method: 'POST', body: JSON.stringify({ body }) },
      true,
    ),
  mine: (filter: 'assigned' | 'created') =>
    request<MineTicket[]>(`/me/tickets?filter=${filter}`, { method: 'GET' }, true),
};

export interface MineTicket extends TicketCard {
  team: { id: string; name: string };
}

export interface NotificationView {
  id: string;
  recipientId: string;
  ticketId: string | null;
  kind: string;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export const notificationsApi = {
  list: () =>
    request<{ items: NotificationView[]; unread: number }>(
      '/notifications',
      { method: 'GET' },
      true,
    ),
  markRead: (id: string) =>
    request<{ success: boolean }>(`/notifications/${id}/read`, { method: 'PATCH' }, true),
  markAllRead: () =>
    request<{ success: boolean }>('/notifications/read-all', { method: 'POST' }, true),
};

export interface AttachmentView {
  id: string;
  ticketId: string | null;
  commentId: string | null;
  type: string;
  url: string;
  fileName: string;
  sizeBytes: number;
  createdAt: string;
  uploadedBy: { id: string; name: string };
}

export const uploadsApi = {
  sign: () =>
    request<{
      cloudName: string;
      apiKey: string;
      timestamp: number;
      signature: string;
      folder: string;
    }>('/uploads/sign', { method: 'POST' }, true),
  createAttachment: (payload: {
    ticketId?: string;
    commentId?: string;
    type: string;
    url: string;
    fileName: string;
    sizeBytes: number;
  }) =>
    request<AttachmentView>('/attachments', { method: 'POST', body: JSON.stringify(payload) }, true),
  deleteAttachment: (id: string) =>
    request<{ success: boolean }>(`/attachments/${id}`, { method: 'DELETE' }, true),
};
