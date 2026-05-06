'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Building2, Users, Briefcase, Activity,
  Upload, Settings, ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Profile, UserRole } from '@/lib/auth/get-user';

const navItems: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: UserRole[];
}[] = [
  { href: '/dashboard',  label: 'Dashboard',  icon: LayoutDashboard, roles: ['super_admin','admin','manager','rep'] },
  { href: '/accounts',   label: 'Accounts',   icon: Building2,       roles: ['super_admin','admin','manager','rep'] },
  { href: '/contacts',   label: 'Contacts',   icon: Users,           roles: ['super_admin','admin','manager','rep'] },
  { href: '/deals',      label: 'Deals',      icon: Briefcase,       roles: ['super_admin','admin','manager','rep'] },
  { href: '/activities', label: 'Activities', icon: Activity,        roles: ['super_admin','admin','manager','rep'] },
  { href: '/import',     label: 'Import',     icon: Upload,          roles: ['super_admin','admin'] },
  { href: '/admin',      label: 'Admin',      icon: Settings,        roles: ['super_admin','admin'] },
  { href: '/console',    label: 'Console',    icon: ShieldCheck,     roles: ['super_admin'] },
];

export function Sidebar({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const visible = navItems.filter(i => i.roles.includes(profile.role));

  return (
    <aside className="w-60 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col border-r border-border/40">
      <div className="px-5 py-5 border-b border-border/40">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-display text-2xl glow-halo">
            P
          </div>
          <div>
            <div className="font-display text-xl tracking-wider leading-none">PROTOSEQ</div>
            <div className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground mt-1.5">
              CRM · v1
            </div>
          </div>
        </Link>
      </div>

      <nav className="flex-1 py-3">
        {visible.map(item => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-5 py-2.5 text-sm transition-all relative',
                active
                  ? 'nav-active text-sidebar-foreground font-medium'
                  : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
              )}
            >
              {active && (
                <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary glow-stripe-soft" />
              )}
              <Icon className={cn('h-4 w-4', active && 'text-primary')} strokeWidth={1.75} />
              <span className="tracking-wide">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border/40">
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
          {profile.role.replace('_', ' ')} access
        </div>
      </div>
    </aside>
  );
}
