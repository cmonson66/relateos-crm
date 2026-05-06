import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUser } from '@/lib/auth/get-user';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { LifecycleBadge } from '@/components/app/lifecycle-badge';
import { VerticalBadge } from '@/components/app/vertical-badge';
import { Attribution } from '@/components/app/attribution';
import { formatRelative, initials } from '@/lib/utils/format';
import { ArrowLeft, Mail, Phone, Building2 } from 'lucide-react';

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await getUser();
  const supabase = await createClient();

  const { data: contact } = await supabase
    .from('contacts')
    .select(`
      *,
      account:accounts(id, name, vertical),
      owner:profiles!contacts_owner_id_fkey(id, full_name, email),
      creator:profiles!contacts_created_by_fkey(id, full_name, email)
    `)
    .eq('id', id)
    .single();

  if (!contact) notFound();

  const fullName = `${contact.first_name} ${contact.last_name || ''}`.trim();

  return (
    <div className="p-8 max-w-6xl">
      <Link href="/contacts" className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground mb-6 transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" /> All contacts
      </Link>

      <div className="card-lit border border-border/40 rounded-md p-7 mb-6 relative">
        <div className="h-[3px] bg-primary glow-stripe rounded-t-md absolute inset-x-0 top-0" />
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-start gap-5 min-w-0">
            <div className="w-16 h-16 rounded-full bg-primary/15 text-primary text-2xl font-display flex items-center justify-center shrink-0 glow-halo">
              {initials(fullName, contact.email || undefined)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <LifecycleBadge stage={contact.lifecycle_stage} />
                {contact.title && <span className="text-xs text-muted-foreground">{contact.title}</span>}
              </div>
              <h1 className="font-display text-5xl tracking-wider leading-none mb-3 truncate">
                {fullName.toUpperCase()}
              </h1>
              <Attribution
                actorName={contact.creator?.full_name || contact.creator?.email}
                action="created"
                timestamp={contact.created_at}
              />
            </div>
          </div>
          <Link href={`/contacts/${id}/edit`} className="shrink-0">
            <Button variant="outline" size="sm">Edit</Button>
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-5 border-t border-border/30">
          <Stat label="Last activity" value={formatRelative(contact.last_activity_at)} />
          <Stat label="Owner" value={contact.owner?.full_name || contact.owner?.email?.split('@')[0] || 'Unassigned'} />
          <Stat label="Email" value={contact.email || '—'} icon={Mail} />
          <Stat label="Phone" value={contact.phone || '—'} icon={Phone} />
        </div>

        {contact.account && (
          <div className="mt-5 pt-5 border-t border-border/30">
            <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-2 flex items-center gap-1.5">
              <Building2 className="h-3 w-3" /> Account
            </div>
            <Link
              href={`/accounts/${contact.account.id}`}
              className="inline-flex items-center gap-2 hover:text-primary transition-colors"
            >
              <span className="font-display text-lg tracking-wider">{contact.account.name.toUpperCase()}</span>
              <VerticalBadge vertical={contact.account.vertical} />
            </Link>
          </div>
        )}
      </div>

      <div className="card-lit border border-border/40 rounded-md p-6 relative">
        <div className="h-[2px] bg-card-foreground/10 rounded-t-md absolute inset-x-0 top-0" />
        <h2 className="font-display text-xl tracking-wider mb-4">NOTES</h2>
        <p className="text-sm text-muted-foreground">
          {contact.notes || <span className="italic">No notes.</span>}
        </p>
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
