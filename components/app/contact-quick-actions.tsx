'use client';

import { Mail, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
    </svg>
  );
}

export function ContactQuickActions({
  email,
  phone,
  linkedinUrl,
  sendHref,
  className,
}: {
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  /** Where the send sheet lives for this contact. Falls back to mailto. */
  sendHref?: string | null;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Goes to the send sheet, not the OS mail client - that is where the
          templates and the send-as-your-own-address button live. The label is
          the word Email rather than the address itself on purpose: iOS turns
          a visible address into its own mailto link and that beats ours. */}
      <QuickAction
        href={email ? (sendHref ?? `mailto:${email}`) : null}
        icon={Mail}
        label="Email"
        disabledLabel="No email"
      />
      <QuickAction
        href={phone ? `tel:${phone}` : null}
        icon={Phone}
        label="Call"
        disabledLabel="No phone"
      />
      <QuickAction
        href={linkedinUrl || null}
        icon={LinkedInIcon}
        label="LinkedIn"
        external
        disabledLabel="No LinkedIn"
      />
    </div>
  );
}

function QuickAction({
  href, icon: Icon, label, external, disabledLabel,
}: {
  href: string | null;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  external?: boolean;
  disabledLabel: string;
}) {
  if (!href) {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border/40 text-xs uppercase tracking-[0.12em] text-muted-foreground/40 cursor-not-allowed"
        title={disabledLabel}
      >
        <Icon className="h-3 w-3" />
        {label}
      </span>
    );
  }
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border/40 text-xs uppercase tracking-[0.12em] text-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-colors"
    >
      <Icon className="h-3 w-3" />
      {label}
    </a>
  );
}
