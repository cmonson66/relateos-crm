// Vertical values are per-instance (see lib/verticals.ts); any string is valid.
export type Vertical = string;
export type ContactLifecycle = 'new' | 'working' | 'engaged' | 'customer' | 'disqualified';
export type ActivityType = 'call' | 'email' | 'meeting' | 'note' | 'task';

export type Account = {
  id: string;
  org_id: string;
  name: string;
  vertical: Vertical;
  website: string | null;
  industry: string | null;
  employee_count: number | null;
  city: string | null;
  state: string | null;
  country: string | null;
  notes: string | null;
  tags: string[];
  owner_id: string | null;
  last_activity_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Contact = {
  id: string;
  org_id: string;
  account_id: string | null;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
  linkedin_url: string | null;
  lifecycle_stage: ContactLifecycle;
  notes: string | null;
  tags: string[];
  owner_id: string | null;
  last_activity_at: string | null;
  legacy_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AccountWithOwner = Account & {
  owner: { id: string; full_name: string | null; email: string } | null;
  contact_count?: number;
};

export type ContactWithRefs = Contact & {
  account: { id: string; name: string; vertical: Vertical } | null;
  owner: { id: string; full_name: string | null; email: string } | null;
};
