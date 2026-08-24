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
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
  tags: string[];
  owner_id: string | null;
  last_activity_at: string | null;
  // 071: street address, its Google place id, and the coordinates that come
  // with it. Without coordinates an account cannot appear on the map or in a
  // canvas run, so a hand-added shop is invisible to both.
  address: string | null;
  place_id: string | null;
  // Derived from the name so chains group without anyone linking them.
  brand_key: string | null;
  // crypto density, synced from nectarpay_leads by sync_crypto_to_accounts()
  crypto_score: number | null;
  crypto_atm_count: number | null;
  crypto_merchant_count: number | null;
  crypto_nearest_atm_m: number | null;
  crypto_scored_at: string | null;
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
