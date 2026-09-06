export type Role = 'FAMILY' | 'COMMUNITY_WORKER' | 'RESPONDER' | 'ADMIN'

export interface User {
  id: string
  name: string
  role: Role
  title: string
  phone_masked: string
  community_id: string
}

export interface Session {
  user: User
  permissions: string[]
}

export interface RiskReason {
  label: string
  delta: number
  kind: string
}

export interface TimelineItem {
  id: string
  action_type: string
  action_label: string
  content: string
  actor_name: string
  created_at: string
}

export interface EventItem {
  id: string
  event_no: string
  subject_id: string
  subject_name: string
  subject_type: 'ELDER' | 'CHILD'
  subject_type_label: string
  subject_age: number
  event_type: string
  event_type_label: string
  source: string
  risk_level: 'P0' | 'P1' | 'P2'
  risk_level_label: string
  risk_score: number
  risk_reasons: RiskReason[]
  status: string
  status_label: string
  description: string
  occurred_at: string
  created_at: string
  first_response_due_at: string
  escalation_due_at: string
  current_assignee_id: string | null
  current_assignee_name: string | null
  current_assignee_title: string | null
  escalation_level: number
  closed_at: string | null
  closed_by: string | null
  close_reason: string | null
  timed_out: boolean
  actions_count: number
  timeline: TimelineItem[]
  assignments: AssignmentItem[]
}

export interface AssignmentItem {
  id: string
  assignee_id: string
  assignee_name: string
  status: string
  assignment_level: number
  assigned_at: string
  accepted_at: string | null
  transferred_at: string | null
  transfer_reason: string | null
}

export interface SubjectItem {
  id: string
  name: string
  subject_type: 'ELDER' | 'CHILD'
  subject_type_label: string
  age: number
  gender: string
  household_id: string
  household_name: string
  building_text: string
  location_text: string
  phone_masked: string | null
  risk_tags: string[]
  last_check_in_at: string | null
  open_event_count: number
  relationships: Array<{ name: string; role: string; relationship_type: string; can_confirm: boolean; can_pickup: boolean }>
  check_in_interval_hours: number | null
  pickup_plan_text: string | null
  notes_safe: string | null
}

export interface NotificationItem {
  id: string
  event_id: string | null
  notification_type: string
  title: string
  content: string
  read_at: string | null
  created_at: string
}

export interface DashboardSummary {
  today_total: number
  open_total: number
  pending_total: number
  in_progress_total: number
  overdue_total: number
  closed_today: number
  risk_counts: Record<string, number>
  subject_type_counts: Record<string, number>
  event_type_counts: Record<string, number>
  average_first_response_minutes: number
  overdue_rate: number
  close_trend: Array<{ date: string; label: string; closed: number }>
}

export interface EventTypeMeta {
  value: string
  label: string
  subject_type: 'ELDER' | 'CHILD'
  default_level: string
  min_level: string
}

export interface ResourceItem { id: string; name: string; role: Role; title: string; phone_masked: string }

export interface ApiError extends Error {
  code?: string
  status?: number
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    ...init,
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(body.message ?? '请求失败') as ApiError
    error.code = body.code
    error.status = response.status
    throw error
  }
  return body as T
}

export const api = {
  login: (role: Role) => request<Session>('/demo-login', { method: 'POST', body: JSON.stringify({ role }) }),
  logout: () => request<{ ok: boolean }>('/demo-logout', { method: 'POST' }),
  me: () => request<Session>('/me'),
  eventTypes: () => request<EventTypeMeta[]>('/event-types'),
  resources: () => request<{ items: ResourceItem[] }>('/resources'),
  people: (params: Record<string, string> = {}) => request<{ items: SubjectItem[]; total: number }>(`/people?${new URLSearchParams(params)}`),
  person: (id: string) => request<SubjectItem>(`/people/${id}`),
  checkIn: (id: string) => request<SubjectItem>(`/people/${id}/check-in`, { method: 'POST' }),
  events: (params: Record<string, string> = {}) => request<{ items: EventItem[]; total: number }>(`/events?${new URLSearchParams(params)}`),
  event: (id: string) => request<EventItem>(`/events/${id}`),
  createEvent: (payload: Record<string, unknown>) => request<EventItem>('/events', { method: 'POST', body: JSON.stringify(payload) }),
  assign: (id: string, payload: { assignee_id: string; reason: string }) => request<EventItem>(`/events/${id}/assign`, { method: 'POST', body: JSON.stringify(payload) }),
  accept: (id: string) => request<EventItem>(`/events/${id}/accept`, { method: 'POST' }),
  action: (id: string, payload: { action_type: string; content: string; complete: boolean }) => request<EventItem>(`/events/${id}/actions`, { method: 'POST', body: JSON.stringify(payload) }),
  eventCheckIn: (id: string) => request<EventItem>(`/events/${id}/check-in`, { method: 'POST' }),
  timeout: (id: string) => request<EventItem>(`/events/${id}/simulate-timeout`, { method: 'POST' }),
  confirmClose: (id: string, reason: string) => request<EventItem>(`/events/${id}/confirm-close`, { method: 'POST', body: JSON.stringify({ reason }) }),
  close: (id: string, reason: string) => request<EventItem>(`/events/${id}/close`, { method: 'POST', body: JSON.stringify({ reason }) }),
  cancel: (id: string, reason: string) => request<EventItem>(`/events/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),
  notifications: (unreadOnly = false) => request<{ items: NotificationItem[]; total: number; unread: number }>(`/notifications?unread_only=${unreadOnly}`),
  readNotification: (id: string) => request<NotificationItem>(`/notifications/${id}/read`, { method: 'PATCH' }),
  readAllNotifications: () => request<{ updated: number }>('/notifications/read-all', { method: 'POST' }),
  dashboard: () => request<DashboardSummary>('/dashboard/summary'),
  reset: () => request<{ ok: boolean }>('/demo/reset', { method: 'POST' }),
}
