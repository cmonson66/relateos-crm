import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUser } from '@/lib/auth/get-user';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { LifecycleBadge } from '@/components/app/lifecycle-badge';
import { VerticalBadge } from '@/components/app/vertical-badge';
import { Attribution } from '@/components/app/attribution';
import { ActivityLogPanel } from '@/components/app/activity-log-panel';
import { ActivityTimelineInner } from '@/components/app/activity-timeline-inner';
import { CommentsPanel } from '@/components/app/comments-panel';
import { RecordTabs } from '@/components/app/record-tabs';
import { ContactQuickActions } from '@/components/app/contact-quick-actions';
import { formatRelative, initials } from '@/lib/utils/format';
import { ArrowLeft, Mail, Phone, Building2, MapPin } from 'lucide-react';
import { formatDealValue } from '@/lib/db/deals';

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
    </svg>
  );
}

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { profile: currentProfile } = await getUser();
  const supabase = await createClient();

  const [
    { data: contact },
    { data: activities },
    { data: profiles },
    { data: auditEntries },
    { data: comments },
  ] = await Promise.all([
    supabase
      .from('contacts')
      .select(`
        *,
        account:accounts(id, name, vertical),
        owner:profiles!contacts_owner_id_fkey(id, full_name, email),
        creator:profiles!contacts_created_by_fkey(id, full_name, email)
      `)
      .eq('id', id).single(),
    supabase.from('activities')
      .select('*, owner:profiles!activities_owner_id_fkey(id, full_name, email), assignee:profiles!activities_assigned_to_fkey(id, full_name, email)')
      .eq('contact_id', id).order('created_at', { ascending: false }).limit(50),
    supabase.from('profiles').select('id, full_name, email').eq('is_active', true).order('full_name'),
    supabase.from('audit_log')
      .select('id, action, changes, created_at, actor:profiles!audit_log_actor_id_fkey(id, full_name, email)')
      .eq('entity_type', 'contact').eq('entity_id', id).order('created_at', { ascending: false }).limit(20),
    supabase.from('comments')
      .select('id, body, mentions, created_at, author:profiles!comments_author_id_fkey(id, full_name, email)')
      .eq('entity_type', 'contact').eq('entity_id', id).order('created_at', { ascending: false }).limit(50),
  ]);

  if (!contact) notFound();

  const { data: deals } = await supabase
    .from('deals_with_stage')
    .select('id, name, value_cents, stage_name, stage_color')
    .eq('primary_contact_id', id)
    .order('value_cents', { ascending: false });

  const fullName = `${contact.first_name} ${contact.last_name || ''}`.trim();

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <Link href="/contacts" className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground mb-5 transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" /> All contacts
      </Link>

      <div className="card-lit border border-border/40 rounded-md p-5 md:p-7 mb-6 relative">
        <div className="h-[3px] bg-primary glow-stripe rounded-t-md absolute inset-x-0 top-0" />
        <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
          <div className="flex items-start gap-4 md:gap-5 min-w-0">
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-primary/15 text-primary text-xl md:text-2xl font-display flex items-center justify-center shrink-0 glow-halo">
              {initials(fullName, contact.email || undefined)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <LifecycleBadge stage={contact.lifecycle_stage} />
                {contact.title && <span className="text-xs text-muted-foreground">{contact.title}</span>}
              </div>
              <h1 className="font-display text-3xl md:text-5xl tracking-wider leading-none mb-3 break-words">
                {fullName.toUpperCase()}
              </h1>
              <Attribution
                actorName={contact.creator?.full_name || contact.creator?.email}
                action="created"
                timestamp={contact.created_at}
              />
              <ContactQuickActions
                email={contact.email}
                phone={contact.phone}
                linkedinUrl={contact.linkedin_url}
                className="mt-4"
              />
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            {contact.account_id && (
              <Link href={`/call/${contact.account_id}`}>
                <Button size="sm" className="font-display tracking-wider btn-glow">📞 Start call</Button>
              </Link>
            )}
            {contact.account_id && (
              <Link href={`/call/${contact.account_id}/sheet`}>
                <Button variant="outline" size="sm" className="font-display tracking-wider" title="Printable walk-in sheet">📄 Sheet</Button>
              </Link>
            )}
            {contact.account_id && (
              <Link href={`/appointments/new?account=${contact.account_id}`}>
                <Button variant="outline" size="sm" className="font-display tracking-wider">📅 Appt</Button>
              </Link>
            )}
            <Link href={`/deals/new?contact=${id}${contact.account_id ? `&account=${contact.account_id}` : ''}`}>
              <Button variant="outline" size="sm" className="font-display tracking-wider">+ Deal</Button>
            </Link>
            {contact.account && (
              <Link href={`/map?focus=${contact.account.id}`}>
                <Button variant="outline" size="sm" className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" /> Map
                </Button>
              </Link>
            )}
            <Link href={`/contacts/${id}/edit`}>
              <Button variant="outline" size="sm">Edit</Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 pt-5 border-t border-border/30">
          <Stat label="Last activity" value={formatRelative(contact.last_activity_at)} />
          <Stat label="Owner" value={contact.owner?.full_name || contact.owner?.email?.split('@')[0] || 'Unassigned'} />
          {contact.email ? (
            <Stat label="Email" customValue={
              <a href={`mailto:${contact.email}`} className="font-display text-sm md:text-base tracking-wider truncate text-primary hover:text-primary/80 hover:underline block">
                {contact.email}
              </a>
            } icon={Mail} />
          ) : (
            <Stat label="Email" value="—" icon={Mail} />
          )}
          <Stat label="Phone" value={contact.phone || '—'} icon={Phone} />
        </div>

        {(contact.account || contact.linkedin_url) && (
          <div className="mt-5 pt-5 border-t border-border/30 flex items-start gap-6 flex-wrap">
            {contact.account && (
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Building2 className="h-3 w-3" /> Account
                </div>
                <Link href={`/accounts/${contact.account.id}`} className="inline-flex items-center gap-2 hover:text-primary transition-colors flex-wrap">
                  <span className="font-display text-base md:text-lg tracking-wider">{contact.account.name.toUpperCase()}</span>
                  <VerticalBadge vertical={contact.account.vertical} />
                </Link>
              </div>
            )}
            {contact.linkedin_url && (
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-2 flex items-center gap-1.5">
                  <LinkedInIcon className="h-3 w-3" /> LinkedIn
                </div>
                <a
                  href={contact.linkedin_url}
                  target="_blank" rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline truncate block max-w-md"
                >
                  {contact.linkedin_url.replace(/^https?:\/\//, '')}
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <ActivityLogPanel
            scope={{ contactId: id, accountId: contact.account_id }}
            profiles={profiles || []}
          />
          <RecordTabs
            commentsCount={(comments || []).length}
            activityNode={
              <ActivityTimelineInner activities={activities || []} auditEntries={auditEntries || []} />
            }
            commentsNode={
              <CommentsPanel
                entityType="contact"
                entityId={id}
                comments={comments || []}
                profiles={profiles || []}
                currentUserId={currentProfile.id}
              />
            }
          />
        </div>

        <div className="space-y-6">
          <div className="card-lit border border-border/40 rounded-md p-5 md:p-6 relative">
            <div className="h-[2px] bg-card-foreground/10 rounded-t-md absolute inset-x-0 top-0" />
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-lg tracking-wider">DEALS · {deals?.length || 0}</h2>
              <Link href={`/deals/new?contact=${id}${contact.account_id ? `&account=${contact.account_id}` : ''}`} className="text-[10px] uppercase tracking-[0.15em] text-primary hover:text-primary/80 min-h-[32px] inline-flex items-center">
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
              <p className="text-xs text-muted-foreground italic">No deals yet on this contact.</p>
            )}
          </div>

          <div className="card-lit border border-border/40 rounded-md p-5 md:p-6 relative">
            <div className="h-[2px] bg-card-foreground/10 rounded-t-md absolute inset-x-0 top-0" />
            <h2 className="font-display text-lg tracking-wider mb-3">NOTES</h2>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {contact.notes || <span className="italic">No notes.</span>}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, customValue, icon: Icon }: {
  label: string;
  value?: string;
  customValue?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-1.5 flex items-center gap-1.5">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </div>
      {customValue || (
        <div className="font-display text-sm md:text-base tracking-wider truncate">{value}</div>
      )}
    </div>
  );
}
