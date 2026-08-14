import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SyncButton } from '../_components/sync-button';
import { BackLink } from '@/components/app/back-link';
import { getUser } from '@/lib/auth/get-user';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { VerticalBadge } from '@/components/app/vertical-badge';
import { Attribution } from '@/components/app/attribution';
import { ActivityLogPanel } from '@/components/app/activity-log-panel';
import { ActivityTimelineInner } from '@/components/app/activity-timeline-inner';
import { CampaignPanel } from '../_components/campaign-panel';
import { CommentsPanel } from '@/components/app/comments-panel';
import { RecordTabs } from '@/components/app/record-tabs';
import { formatRelative, initials } from '@/lib/utils/format';
import { formatDealValue } from '@/lib/db/deals';
import { ArrowLeft, MapPin, Globe, Users as UsersIcon, Tag } from 'lucide-react';
import { ReferralPanel } from '../_components/referral-panel';

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { profile: currentProfile } = await getUser();
  const supabase = await createClient();

  const [
    { data: account },
    { data: contacts },
    { data: deals },
    { data: activities },
    { data: profiles },
    { data: auditEntries },
    { data: comments },
  ] = await Promise.all([
    supabase
      .from('accounts')
      .select('*, owner:profiles!accounts_owner_id_fkey(id, full_name, email), creator:profiles!accounts_created_by_fkey(id, full_name, email)')
      .eq('id', id).single(),
    supabase.from('contacts').select('id, first_name, last_name, title, email, lifecycle_stage, legacy_id').eq('account_id', id).order('created_at', { ascending: false }),
    supabase.from('deals_with_stage').select('id, name, value_cents, stage_name, stage_color').eq('account_id', id).order('value_cents', { ascending: false }),
    supabase.from('activities')
      .select('*, owner:profiles!activities_owner_id_fkey(id, full_name, email), assignee:profiles!activities_assigned_to_fkey(id, full_name, email)')
      .eq('account_id', id).order('created_at', { ascending: false }).limit(50),
    supabase.from('profiles').select('id, full_name, email').eq('is_active', true).order('full_name'),
    supabase.from('audit_log')
      .select('id, action, changes, created_at, actor:profiles!audit_log_actor_id_fkey(id, full_name, email)')
      .eq('entity_type', 'account').eq('entity_id', id).order('created_at', { ascending: false }).limit(20),
    supabase.from('comments')
      .select('id, body, mentions, created_at, author:profiles!comments_author_id_fkey(id, full_name, email)')
      .eq('entity_type', 'account').eq('entity_id', id).order('created_at', { ascending: false }).limit(50),
  ]);
  // Where this shop stands in the email sequence. get_call_intel (034/041)
  // is a security-definer bridge, so reps see it without lead-table access.
  // Signed trial agreements for this shop - a rep on the road needs the copy
  // link at hand, not buried somewhere in the timeline
  const { data: testimonials } = await supabase
    .from('testimonials')
    .select('id, quote, attribution')
    .eq('account_id', id)
    .order('created_at', { ascending: false });

  const { data: agreements } = await supabase
    .from('trial_agreements')
    .select('id, token, kind, signer_name, trial_start, trial_end, signed_at')
    .eq('account_id', id)
    .order('signed_at', { ascending: false });

  const legacyId = (contacts ?? []).map(c => (c as { legacy_id?: string }).legacy_id).find(Boolean) ?? null;
  let campaign: {
    email_stage?: number; status?: string; band?: string; score?: number;
    monthly_volume?: number | null; pulse_token?: string | null; emails?: number;
  } | null = null;
  let pulseUrl: string | null = null;
  if (legacyId) {
    const { data: intel } = await supabase.rpc('get_call_intel', { p_legacy_id: legacyId });
    if (intel && Object.keys(intel).length > 0) {
      campaign = intel;
      if (campaign?.pulse_token) {
        const { data: base } = await supabase.rpc('get_pulse_base');
        if (base) pulseUrl = `${String(base).replace(/\/$/, '')}/s/${campaign.pulse_token}`;
      }
    }
  }


  if (!account) notFound();

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <BackLink fallbackHref="/accounts" fallbackLabel="All accounts" />

      <div className="card-lit border border-border/40 rounded-md p-5 md:p-7 mb-6 relative">
        <div className="h-[3px] bg-primary glow-stripe rounded-t-md absolute inset-x-0 top-0" />
        <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <VerticalBadge vertical={account.vertical} />
              {account.industry && <span className="text-xs text-muted-foreground">{account.industry}</span>}
            </div>
            <h1 className="font-display text-3xl md:text-5xl tracking-wider leading-none mb-3 break-words">
              {account.name.toUpperCase()}
            </h1>
            <Attribution
              actorName={account.creator?.full_name || account.creator?.email}
              action="created"
              timestamp={account.created_at}
            />
          </div>
          <div className="flex flex-wrap gap-2 md:shrink-0">
            <Link href={`/call/${id}`}>
              <Button size="sm" className="font-display tracking-wider btn-glow">📞 Start call</Button>
            </Link>
            <Link href={`/send/${id}`}>
              <Button variant="outline" size="sm" className="font-display tracking-wider" title="Send a message from a template">✉ Send</Button>
            </Link>
            {/* Lands on the send screen with the one-pager message already
                picked, so it is two taps from here to it being in their
                inbox. */}
            <Link href={`/send/${id}?t=one-pager`}>
              <Button variant="outline" size="sm" className="font-display tracking-wider" title="Email or text the one-pager">📄 One-pager</Button>
            </Link>
            <Link href={`/appointments/new?account=${id}`}>
              <Button variant="outline" size="sm" className="font-display tracking-wider">📅 Appt</Button>
            </Link>
            <Link href={`/call/${id}/sheet`}>
              <Button variant="outline" size="sm" className="font-display tracking-wider" title="Printable walk-in sheet">📄 Sheet</Button>
            </Link>
            <Link href={`/contacts/new?account=${id}`}>
              <Button variant="outline" size="sm" className="font-display tracking-wider">+ Contact</Button>
            </Link>
            <SyncButton accountId={id} />
            <Link href={`/deals/new?account=${id}`}>
              <Button variant="outline" size="sm" className="font-display tracking-wider">+ Deal</Button>
            </Link>
            <Link href={`/accounts/${id}/edit`}>
              <Button variant="outline" size="sm">Edit</Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 pt-5 border-t border-border/30">
          <Stat label="Last activity" value={formatRelative(account.last_activity_at)} />
          <Stat label="Owner" value={account.owner?.full_name || account.owner?.email?.split('@')[0] || 'Unassigned'} />
          <Stat label="Location" value={[account.city, account.state].filter(Boolean).join(', ') || '—'} icon={MapPin} />
          <Stat label="Employees" value={account.employee_count?.toLocaleString() || '—'} icon={UsersIcon} />
        </div>

        {account.tags && account.tags.length > 0 && (
          <div className="flex items-center gap-2 mt-5 pt-5 border-t border-border/30 text-xs text-muted-foreground flex-wrap">
            <Tag className="h-3.5 w-3.5" />
            {account.tags.map((t: string) => (
              <span key={t} className="px-2 py-0.5 rounded-md bg-muted/40 border border-border/30">{t}</span>
            ))}
          </div>
        )}

        {account.website && (
          <div className="flex items-center gap-2 mt-3 text-xs">
            <Globe className="h-3.5 w-3.5 text-muted-foreground" />
            <a href={account.website} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate">
              {account.website}
            </a>
          </div>
        )}
      </div>

      {campaign && (
        <CampaignPanel
          intel={campaign}
          pulseUrl={pulseUrl}
          accountId={id}
          canEdit={['super_admin', 'admin', 'manager', 'rep'].includes(currentProfile.role)}
        />
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <ActivityLogPanel
            scope={{ accountId: id }}
            profiles={profiles || []}
          />
          <RecordTabs
            commentsCount={(comments || []).length}
            activityNode={
              <ActivityTimelineInner
                activities={activities || []}
                auditEntries={auditEntries || []}
              />
            }
            commentsNode={
              <CommentsPanel
                entityType="account"
                entityId={id}
                comments={comments || []}
                profiles={profiles || []}
                currentUserId={currentProfile.id}
              />
            }
          />
        </div>

        <div className="space-y-6">
          <ReferralPanel
            accountId={id}
            testimonials={(testimonials ?? []).map(t => ({
              id: t.id as string,
              quote: t.quote as string,
              attribution: (t.attribution as string | null) ?? null,
            }))}
          />

          {agreements && agreements.length > 0 && (
            <div className="card-lit border border-border/40 rounded-md p-5 md:p-6 relative">
              <div className="h-[2px] bg-amber-500/60 rounded-t-md absolute inset-x-0 top-0" />
              <h2 className="font-display text-lg tracking-wider mb-3">SIGNED AGREEMENTS · {agreements.length}</h2>
              <div className="space-y-1.5">
                {agreements.map(a => (
                  <a key={a.id} href={`/agreement/${a.token}`} target="_blank" rel="noreferrer"
                    className="block py-2.5 px-2 rounded-md hover:bg-primary/5 transition-colors -mx-2 min-h-[44px]">
                    <div className="flex items-center gap-2">
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                        a.kind === 'purchase'
                          ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                          : 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                      }`}>
                        {a.kind === 'purchase' ? 'Purchase' : 'Trial'}
                      </span>
                      <span className="text-sm font-medium truncate">Signed by {a.signer_name}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {a.kind === 'purchase'
                        ? `${new Date(a.signed_at as string).toLocaleDateString('en-US', { dateStyle: 'medium', timeZone: 'America/Phoenix' })} · view the signed copy`
                        : `${a.trial_start} to ${a.trial_end} · view the signed copy`}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="card-lit border border-border/40 rounded-md p-5 md:p-6 relative">
            <div className="h-[2px] bg-card-foreground/10 rounded-t-md absolute inset-x-0 top-0" />
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-lg tracking-wider">CONTACTS · {contacts?.length || 0}</h2>
              <Link href={`/contacts/new?account=${id}`} className="text-[10px] uppercase tracking-[0.15em] text-primary hover:text-primary/80 min-h-[32px] inline-flex items-center">
                + Add
              </Link>
            </div>
            {contacts && contacts.length > 0 ? (
              <div className="space-y-1.5">
                {contacts.map(c => (
                  <Link key={c.id} href={`/contacts/${c.id}`}
                    className="flex items-center gap-3 py-2.5 px-2 rounded-md hover:bg-primary/5 transition-colors -mx-2 min-h-[44px]"
                  >
                    <div className="w-7 h-7 rounded-full bg-primary/15 text-primary text-[10px] font-medium flex items-center justify-center shrink-0">
                      {initials(`${c.first_name} ${c.last_name || ''}`)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{c.first_name} {c.last_name}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{c.title || c.email}</div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">No contacts yet.</p>
            )}
          </div>

          <div className="card-lit border border-border/40 rounded-md p-5 md:p-6 relative">
            <div className="h-[2px] bg-card-foreground/10 rounded-t-md absolute inset-x-0 top-0" />
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-lg tracking-wider">DEALS · {deals?.length || 0}</h2>
              <Link href={`/deals/new?account=${id}`} className="text-[10px] uppercase tracking-[0.15em] text-primary hover:text-primary/80 min-h-[32px] inline-flex items-center">
                + Add
              </Link>
            </div>
            {deals && deals.length > 0 ? (
              <div className="space-y-1.5">
                {deals.map(d => (
                  <Link key={d.id} href={`/deals/${d.id}`}
                    className="flex items-center justify-between py-2.5 px-2 rounded-md hover:bg-primary/5 transition-colors -mx-2 min-h-[44px]"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{d.name}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: d.stage_color || '#94A3B8' }} />
                        <span className="text-[10px] text-muted-foreground">{d.stage_name}</span>
                      </div>
                    </div>
                    <div className="text-xs font-display tracking-wider text-primary shrink-0">
                      {formatDealValue(d.value_cents)}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">No deals yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: string; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-1.5 flex items-center gap-1.5">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </div>
      <div className="font-display text-sm md:text-base tracking-wider truncate">{value}</div>
    </div>
  );
}
