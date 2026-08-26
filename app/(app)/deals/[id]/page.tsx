import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUser } from '@/lib/auth/get-user';
import Link from 'next/link';
import { ArrowLeft, Calendar, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DeleteDealButton } from '../_components/delete-deal-button';
import { BackLink } from '@/components/app/back-link';
import { VerticalBadge } from '@/components/app/vertical-badge';
import { Attribution } from '@/components/app/attribution';
import { ActivityLogPanel } from '@/components/app/activity-log-panel';
import { ActivityTimelineInner } from '@/components/app/activity-timeline-inner';
import { CommentsPanel } from '@/components/app/comments-panel';
import { RecordTabs } from '@/components/app/record-tabs';
import { formatRelative, formatDate, initials } from '@/lib/utils/format';
import { formatDealValue } from '@/lib/db/deals';
import { StageSelector } from '../_components/stage-selector';
import { TrialPanel } from '../_components/trial-panel';
import { WelcomePanel } from '../_components/welcome-panel';
import { SetupPanel } from '../_components/setup-panel';
import { DealItemsPanel } from '../_components/deal-items-panel';
import { PaperworkPanel } from '../_components/paperwork-panel';
import { phxToday } from '@/lib/db/trials';

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { profile: currentProfile } = await getUser();
  const supabase = await createClient();

  const [
    { data: deal },
    { data: stages },
    { data: profiles },
    { data: activities },
    { data: auditEntries },
    { data: comments },
  ] = await Promise.all([
    supabase
      .from('deals_with_stage')
      .select(`
        *,
        account:accounts(id, name, vertical),
        contact:contacts!deals_primary_contact_id_fkey(id, first_name, last_name),
        owner:profiles!deals_owner_id_fkey(id, full_name, email),
        creator:profiles!deals_created_by_fkey(id, full_name, email)
      `)
      .eq('id', id).single(),
    supabase.from('pipeline_stages').select('*').order('position'),
    supabase.from('profiles').select('id, full_name, email').eq('is_active', true).order('full_name'),
    supabase.from('activities')
      .select('*, owner:profiles!activities_owner_id_fkey(id, full_name, email), assignee:profiles!activities_assigned_to_fkey(id, full_name, email)')
      .eq('deal_id', id).order('created_at', { ascending: false }).limit(50),
    supabase.from('audit_log')
      .select('id, action, changes, created_at, actor:profiles!audit_log_actor_id_fkey(id, full_name, email)')
      .eq('entity_type', 'deal').eq('entity_id', id).order('created_at', { ascending: false }).limit(20),
    supabase.from('comments')
      .select('id, body, mentions, created_at, author:profiles!comments_author_id_fkey(id, full_name, email)')
      .eq('entity_type', 'deal').eq('entity_id', id).order('created_at', { ascending: false }).limit(50),
  ]);

  if (!deal) notFound();

  // Line items and the catalog. Fetched after the deal so a missing deal
  // short-circuits before two more round trips.
  const [{ data: itemRows }, { data: productRows }] = await Promise.all([
    supabase
      .from('deal_items')
      .select('id, product_id, qty, unit_price_cents, billing, serial_number, products(name, sku)')
      .eq('deal_id', id)
      .order('created_at'),
    supabase
      .from('products')
      .select('id, sku, name, kind, unit_price_cents, billing')
      .eq('active', true)
      .order('unit_price_cents', { ascending: false }),
  ]);

  const dealItems = (itemRows ?? []).map((r) => {
    const prod = r.products as unknown as { name?: string; sku?: string } | null;
    return {
      id: r.id as string,
      product_id: r.product_id as string,
      qty: r.qty as number,
      unit_price_cents: r.unit_price_cents as number,
      billing: r.billing as 'one_time' | 'monthly',
      serial_number: (r.serial_number as string | null) ?? null,
      product_name: prod?.name ?? 'Item',
      sku: prod?.sku ?? '',
    };
  });

  const [{ data: invRows }, { data: purchaseAgreements }] = await Promise.all([
    supabase
      .from('invoices')
      .select('id, number, token, total_cents, status, sent_at, paid_at, paid_method')
      .eq('deal_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('trial_agreements')
      .select('id')
      .eq('deal_id', id)
      .eq('kind', 'purchase')
      .limit(1),
  ]);

  const invoiceRows = (invRows ?? []).map((r) => ({
    id: r.id as string,
    number: r.number as string,
    token: r.token as string,
    total_cents: r.total_cents as number,
    status: r.status as string,
    sent_at: (r.sent_at as string | null) ?? null,
    paid_at: (r.paid_at as string | null) ?? null,
    paid_method: (r.paid_method as string | null) ?? null,
  }));
  const hasPurchaseAgreement = (purchaseAgreements ?? []).length > 0;

  // Merchant setup progress (072). Its own query rather than a join: the rows
  // are written by an unauthenticated merchant through a security-definer RPC,
  // so they arrive independently of anything else on this page, and a shop
  // that has never opened the link simply has none.
  const { data: setupRows } = await supabase
    .from('merchant_setup_steps')
    .select('step, done_at')
    .eq('deal_id', id);
  const setupSteps: Record<string, string | null> = Object.fromEntries(
    (setupRows ?? []).map((r) => [r.step as string, (r.done_at as string | null) ?? null]),
  );

  const products = (productRows ?? []).map((p) => ({
    id: p.id as string,
    sku: p.sku as string,
    name: p.name as string,
    kind: p.kind as string,
    unit_price_cents: p.unit_price_cents as number,
    billing: p.billing as 'one_time' | 'monthly',
  }));

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <BackLink fallbackHref="/deals" fallbackLabel="All deals" />

      <div className="card-lit border border-border/40 rounded-md p-5 md:p-7 mb-6 relative">
        <div className="h-[3px] bg-primary glow-stripe rounded-t-md absolute inset-x-0 top-0" />
        <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
              {deal.account && (
                <Link href={`/accounts/${deal.account.id}`} className="text-xs hover:text-primary truncate">
                  {deal.account.name}
                </Link>
              )}
              {deal.account && <VerticalBadge vertical={deal.account.vertical} />}
            </div>
            <h1 className="font-display text-3xl md:text-5xl tracking-wider leading-none mb-3 break-words">
              {deal.name.toUpperCase()}
            </h1>
            <Attribution
              actorName={deal.creator?.full_name || deal.creator?.email}
              action="created"
              timestamp={deal.created_at}
            />
          </div>
          <div className="flex flex-wrap gap-2 md:shrink-0">
            <Link href={`/deals/${id}/edit`}>
              <Button variant="outline" size="sm">Edit</Button>
            </Link>
            <DeleteDealButton dealId={id} dealName={deal.name} />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 pt-5 border-t border-border/30">
          <Stat
            label={invoiceRows.some(i => i.status === 'paid') ? 'Collected' : 'Expected value'}
            value={formatDealValue(deal.value_cents)}
            highlight
          />
          <Stat label="Stage" customValue={
            <StageSelector dealId={deal.id} currentStageId={deal.stage_id} stages={stages || []} />
          } />
          <Stat label="Days in stage" value={`${deal.days_in_stage}d`} warn={deal.days_in_stage >= 14 && !deal.stage_is_won && !deal.stage_is_lost} />
          <Stat label="Expected close" value={deal.expected_close_date ? formatDate(deal.expected_close_date) : '—'} icon={Calendar} />
        </div>

        {deal.contact && (
          <div className="mt-5 pt-5 border-t border-border/30 flex items-center gap-3">
            <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Champion</div>
            <Link href={`/contacts/${deal.contact.id}`} className="flex items-center gap-2 hover:text-primary transition-colors min-w-0">
              <div className="w-7 h-7 rounded-full bg-primary/15 text-primary text-[10px] font-medium flex items-center justify-center shrink-0">
                {initials(`${deal.contact.first_name} ${deal.contact.last_name || ''}`)}
              </div>
              <span className="text-sm truncate">{deal.contact.first_name} {deal.contact.last_name}</span>
            </Link>
          </div>
        )}
      </div>

      <DealItemsPanel dealId={deal.id} items={dealItems} products={products} />

      <TrialPanel
        dealId={deal.id}
        trial={{
          trial_start: deal.trial_start ?? null,
          trial_days: deal.trial_days ?? null,
          trial_end: deal.trial_end ?? null,
          terminal_serial: deal.terminal_serial ?? null,
          trial_outcome: deal.trial_outcome ?? null,
        }}
        today={phxToday()}
      />

      <PaperworkPanel
        dealId={deal.id}
        hasItems={dealItems.length > 0}
        hasPurchaseAgreement={hasPurchaseAgreement}
        invoices={invoiceRows}
        siteUrl={(process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '')}
      />

      <SetupPanel
        dealId={deal.id}
        steps={setupSteps}
        existingUrl={
          deal.welcome_token
            ? `${(process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "")}/setup/${deal.welcome_token}`
            : null
        }
      />

      <WelcomePanel
        dealId={deal.id}
        existingUrl={
          deal.welcome_token
            ? `${(process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "")}/start/${deal.welcome_token}`
            : null
        }
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <ActivityLogPanel
            scope={{ dealId: deal.id, accountId: deal.account_id, contactId: deal.primary_contact_id }}
            profiles={profiles || []}
          />
          <RecordTabs
            commentsCount={(comments || []).length}
            activityNode={
              <ActivityTimelineInner activities={activities || []} auditEntries={auditEntries || []} />
            }
            commentsNode={
              <CommentsPanel
                entityType="deal"
                entityId={id}
                comments={comments || []}
                profiles={profiles || []}
                currentUserId={currentProfile.id}
              />
            }
          />
        </div>

        <div className="card-lit border border-border/40 rounded-md p-5 md:p-6 relative">
          <div className="h-[2px] bg-card-foreground/10 rounded-t-md absolute inset-x-0 top-0" />
          <h2 className="font-display text-xl tracking-wider mb-4">NOTES</h2>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
            {deal.notes || <span className="italic">No notes.</span>}
          </p>
          {deal.owner && (
            <div className="mt-5 pt-5 border-t border-border/30">
              <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-2">Owner</div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-primary/15 text-primary text-[10px] font-medium flex items-center justify-center">
                  {initials(deal.owner.full_name, deal.owner.email)}
                </div>
                <span className="text-sm truncate">{deal.owner.full_name || deal.owner.email}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label, value, customValue, icon: Icon, highlight, warn,
}: {
  label: string;
  value?: string;
  customValue?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  highlight?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-1.5 flex items-center gap-1.5">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </div>
      {customValue ? customValue : (
        <div className={`font-display text-sm md:text-base tracking-wider truncate ${
          highlight ? 'text-primary text-glow-primary text-xl md:text-2xl' : warn ? 'text-destructive' : ''
        }`}>
          {value}
        </div>
      )}
    </div>
  );
}
