'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Building2, Users, Briefcase, Activity,
  Upload, Settings, ShieldCheck, LockKeyhole, Palette, X,
  Map as MapIcon,
  CalendarDays,
  Megaphone,
  HardDrive,
  Coins,
  BookOpen, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Profile, UserRole } from '@/lib/auth/get-user';
import type { ResolvedBrand } from '@/lib/brand/brand';

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
  { href: '/map',        label: 'Map',        icon: MapIcon,         roles: ['super_admin','admin','manager','rep'] },
  { href: '/calendar',   label: 'Calendar',   icon: CalendarDays,    roles: ['super_admin','admin','manager','rep'] },
  { href: '/campaigns',  label: 'Campaign',   icon: Megaphone,       roles: ['super_admin','admin'] },
  { href: '/terminals',  label: 'Inventory',  icon: HardDrive,       roles: ['super_admin','admin','manager'] },
  { href: '/earnings',   label: 'Earnings',   icon: Coins,           roles: ['super_admin','admin','manager','rep'] },
  { href: '/playbook',   label: 'Playbook',   icon: BookOpen,        roles: ['super_admin','admin','manager','rep'] },
  { href: '/activities', label: 'Activities', icon: Activity,        roles: ['super_admin','admin','manager','rep'] },
  { href: '/import',     label: 'Import',     icon: Upload,          roles: ['super_admin','admin','manager','rep'] },
  { href: '/regions',    label: 'Regions',    icon: Globe,           roles: ['super_admin','admin'] },
  { href: '/admin',      label: 'Admin',      icon: Settings,        roles: ['super_admin','admin'] },
  { href: '/branding',   label: 'Branding',   icon: Palette,         roles: ['super_admin','admin'] },
  { href: '/console',    label: 'Console',    icon: ShieldCheck,     roles: ['super_admin'] },
  { href: '/system',     label: 'System',     icon: LockKeyhole,     roles: ['super_admin'] },
];

export function Sidebar({
  profile,
  brand,
  mobileOpen,
  onMobileClose,
}: {
  profile: Profile;
  brand: ResolvedBrand;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const pathname = usePathname();
  const visible = navItems.filter(i => i.roles.includes(profile.role));

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          onClick={onMobileClose}
          aria-label="Close menu"
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
        />
      )}

      <aside
        className={cn(
          'w-60 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col border-r border-border/40',
          'fixed inset-y-0 left-0 z-50 md:static md:z-auto',
          'transition-transform md:transition-none',
          mobileOpen ? 'translate-x-0 animate-drawer-in' : '-translate-x-full md:translate-x-0'
        )}
      >
        <div className="px-5 py-5 border-b border-border/40 flex items-center justify-between">
          <Link href="/dashboard" onClick={onMobileClose} className="flex items-center gap-3">
            {brand.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={brand.logoUrl}
                alt={brand.name}
                className="w-10 h-10 rounded-md object-cover glow-halo"
              />
            ) : (
              <div className="w-10 h-10 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-display text-2xl glow-halo">
                {brand.initial}
              </div>
            )}
            <div>
              <div className="font-display text-xl tracking-wider leading-none">{brand.name.toUpperCase()}</div>
              <div className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground mt-1.5">
                {brand.tagline}
              </div>
            </div>
          </Link>
          <button
            type="button"
            onClick={onMobileClose}
            aria-label="Close menu"
            className="md:hidden h-9 w-9 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 py-3 overflow-y-auto">
          {visible.map(item => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onMobileClose}
                className={cn(
                  'flex items-center gap-3 px-5 py-3 text-sm transition-all relative min-h-[44px]',
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
    </>
  );
}
