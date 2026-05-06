import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUser } from '@/lib/auth/get-user';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { VerticalBadge } from '@/components/app/vertical-badge';
import { Attribution } from '@/components/app/attribution';
import { ActivityLogPanel } from '@/components/app/activity-log-panel';
import { ActivityTimeline } from '@/components/app/activity-timeline';
import { formatRelative, initials } from '@/lib/utils/format';
import { formatDealValue } from '@/lib/db/deals';
import { ArrowLeft, MapPin, Globe, Users as UsersIcon, Tag } from 'lucide-react';

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await getUser();
  const supabase = await createClient();

  const [
    { data: account },
    { data: contacts },
    { data: deals },
    { data: activities },
    { data: profiles },
    { data: auditEntries },
  ] = await Promise.all([
    supabase
      .from('accounts')
      .select('*, owner:profiles!accounts_owner_id_fkey(id, full_name, email), creator:profiles!accounts_created_by_fkey(id, full_name, email)')
      .eq('id', id)
      .single(),
    supabase
      .from('contacts')
      .select('id, first_name, last_name, title, email, lifecycle_stage')
      .eq('account_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('deals_with_stage')
      .select('id, name, value_cents, stage_name, stage_color')
      .eq('account_id', id)
      .order('value_cents', { ascending: false }),
    supabase
      .from('activities')
      .select('*, owner:profiles!activities_owner_id_fkey(id, full_name, email), assignee:profiles!activities_assigned_to_fkey(id, full_name, email)')
      .eq('account_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('profiles').select('id, full_name, email').eq('is_active', true).order('full_name'),
    supabase
      .from('audit_log')
      .select('id, action, changes, created_at, actor:profiles!audit_log_actor_id_fkey(id, full_name, email)')
      .eq('entity_type', 'account')
      .eq('entity_id', id)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  if (!account) notFound();

  return (
    <div className="p-8 max-w-6xl">
      <Link href="/accounts" className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground mb-6 transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" /> All accounts
      </Link>

      <div className="card-lit border border-border/40 rounded-md p-7 mb-6 relative">
        <div className="h-[3px] bg-primary glow-stripe rounded-t-md absolute inset-x-0 top-0" />
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <VerticalBadge vertical={account.vertical} />
              {account.industry && <span className="text-xs text-muted-foreground">{account.industry}</span>}
            </div>
            <h1 className="font-display text-5xl tracking-wider leading-none mb-3">
              {account.name.toUpperCase()}
            </h1>
            <Attribution
              actorName={account.creator?.full_name || account.creator?.email}
              action="created"
              timestamp={account.created_at}
            />
          </div>
          <div className="flex gap-2 shrink-0">
            <Link href={`/deals/new?account=${id}`}>
              <Button size="sm" className="font-display tracking-wider btn-glow">+ Deal</Button>
            </Link>
            <Link href={`/accounts/${id}/edit`}>
              <Button variant="outline" size="sm">Edit</Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-5 border-t border-border/30">
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
            <a href={account.website} target="_blank" rel="noreferrer" className="text-primary hover:underline">
              {account.website}
            </a>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <ActivityLogPanel
            scope={{ accountId: id }}
            profiles={profiles || []}
          />
          <ActivityTimeline
            activities={activities || []}
            auditEntries={auditEntries || []}
          />
        </div>

        <div className="space-y-6">
          <div className="card-lit border border-border/40 rounded-md p-6 relative">
            <div className="h-[2px] bg-card-foreground/10 rounded-t-md absolute inset-x-0 top-0" />
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-lg tracking-wider">CONTACTS · {contacts?.length || 0}</h2>
              <Link href={`/contacts/new?account=${id}`} className="text-[10px] uppercase tracking-[0.15em] text-primary hover:text-primary/80">
                + Add
              </Link>
            </div>
            {contacts && contacts.length > 0 ? (
              <div className="space-y-1.5">
                {contacts.map(c => (
                  <Link key={c.id} href={`/contacts/${c.id}`}
                    className="flex items-center gap-3 py-2 px-2 rounded-md hover:bg-primary/5 transition-colors -mx-2"
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

          <div className="card-lit border border-border/40 rounded-md p-6 relative">
            <div className="h-[2px] bg-card-foreground/10 rounded-t-md absolute inset-x-0 top-0" />
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-lg tracking-wider">DEALS · {deals?.length || 0}</h2>
              <Link href={`/deals/new?account=${id}`} className="text-[10px] uppercase tracking-[0.15em] text-primary hover:text-primary/80">
                + Add
              </Link>
            </div>
            {deals && deals.length > 0 ? (
              <div className="space-y-1.5">
                {deals.map(d => (
                  <Link key={d.id} href={`/deals/${d.id}`}
                    className="flex items-center justify-between py-2 px-2 rounded-md hover:bg-primary/5 transition-colors -mx-2"
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
    <div>
      <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-1.5 flex items-center gap-1.5">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </div>
      <div className="font-display text-base tracking-wider truncate">{value}</div>
    </div>
  );
}
