export type PipelineStage = {
  id: string;
  org_id: string;
  name: string;
  slug: string;
  position: number;
  is_won: boolean;
  is_lost: boolean;
  color: string | null;
};

export type Deal = {
  id: string;
  org_id: string;
  account_id: string;
  primary_contact_id: string | null;
  name: string;
  stage_id: string;
  value_cents: number;
  expected_close_date: string | null;
  closed_at: string | null;
  notes: string | null;
  tags: string[];
  owner_id: string | null;
  last_activity_at: string | null;
  stage_entered_at: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  trial_start: string | null;
  trial_days: number | null;
  trial_end: string | null;
  terminal_serial: string | null;
  trial_outcome: string | null;
  welcome_token: string | null;
};

export type DealWithRefs = Deal & {
  account: { id: string; name: string; vertical: string } | null;
  contact: { id: string; first_name: string; last_name: string | null } | null;
  owner: { id: string; full_name: string | null; email: string } | null;
  stage: PipelineStage;
  days_in_stage: number;
  days_open: number;
};

export function formatDealValue(cents: number | null): string {
  if (!cents) return '$0';
  const dollars = cents / 100;
  if (dollars >= 1_000_000) return '$' + (dollars / 1_000_000).toFixed(1) + 'M';
  if (dollars >= 1_000) return '$' + Math.round(dollars / 1000) + 'k';
  return '$' + dollars.toLocaleString();
}
