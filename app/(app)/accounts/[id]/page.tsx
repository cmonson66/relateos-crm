import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUser } from '@/lib/auth/get-user';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { VerticalBadge } from '@/components/app/vertical-badge';
import { Attribution } from '@/components/app/attribution';
import { formatRelative, initials } from '@/lib/utils/format';
import { ArrowLeft, MapPin, Globe, Users as UsersIcon, Tag } from 'lucide-react';

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await getUser();
  const supabase = await createClient();

  const { data: account } = await supabase
    .from('accounts')
    .select('*, owner:profiles!accounts_owner_id_fkey(id, full_name, email), creator:profiles!accounts_created_by_fkey(id, full_name, email)')
    .eq('id', id)
    .single();

  if (!account) notFound();

  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, title, email, lifecycle_stage')
    .eq('account_id', id)
    .order('created_at', { ascending: false });

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
              {account.industry && (
                <span className="text-xs text-muted-foreground">{account.industry}</span>
              )}
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
          <div className="flex items-center gap-2 mt-5 pt-5 border-t border-border/30 text-xs text-muted-foreground">
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
        <div className="md:col-span-2 card-lit border border-border/40 rounded-md p-6 relative">
          <div className="h-[2px] bg-card-foreground/10 rounded-t-md absolute inset-x-0 top-0" />
          <h2 className="font-display text-xl tracking-wider mb-4">CONTACTS · {contacts?.length || 0}</h2>
          {contacts && contacts.length > 0 ? (
            <div className="space-y-2">
              {contacts.map(c => (
                <Link
                  key={c.id}
                  href={`/contacts/${c.id}`}
                  className="flex items-center justify-between py-2.5 px-3 rounded-md hover:bg-primary/5 transition-colors -mx-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-primary/15 text-primary text-xs font-medium flex items-center justify-center shrink-0">
                      {initials(`${c.first_name} ${c.last_name || ''}`)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{c.first_name} {c.last_name}</div>
                      <div className="text-xs text-muted-foreground truncate">{c.title || c.email}</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">No contacts yet on this account.</p>
          )}
        </div>

        <div className="card-lit border border-border/40 rounded-md p-6 relative">
          <div className="h-[2px] bg-card-foreground/10 rounded-t-md absolute inset-x-0 top-0" />
          <h2 className="font-display text-xl tracking-wider mb-4">NOTES</h2>
          <p className="text-sm text-muted-foreground">
            {account.notes || <span className="italic">No notes.</span>}
          </p>
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
