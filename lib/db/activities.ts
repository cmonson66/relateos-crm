export type ActivityRow = {
  id: string;
  org_id: string;
  type: 'call' | 'email' | 'meeting' | 'note' | 'task';
  direction: 'inbound' | 'outbound' | 'internal' | null;
  subject: string | null;
  body: string | null;
  account_id: string | null;
  contact_id: string | null;
  deal_id: string | null;
  scheduled_at: string | null;
  completed_at: string | null;
  duration_minutes: number | null;
  owner_id: string;
  assigned_to: string | null;
  assigned_by: string | null;
  assignment_note: string | null;
  created_at: string;
  updated_at: string;
};

export type ActivityWithRefs = ActivityRow & {
  owner: { id: string; full_name: string | null; email: string } | null;
  assignee: { id: string; full_name: string | null; email: string } | null;
};
