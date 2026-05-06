'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LogOut, User, Search, Menu } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/lib/auth/get-user';
import { NotificationBell } from '@/components/app/notification-bell';

export function Header({
  profile,
  onMobileMenuClick,
}: {
  profile: Profile;
  onMobileMenuClick?: () => void;
}) {
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const initials = (profile.full_name || profile.email)
    .split(' ')
    .map(s => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const roleLabel = profile.role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());

  return (
    <header className="h-14 border-b border-border/40 bg-background/50 backdrop-blur-sm px-4 md:px-6 flex items-center justify-between">
      <div className="flex items-center gap-3 min-w-0">
        {/* Hamburger on mobile */}
        <button
          type="button"
          onClick={onMobileMenuClick}
          aria-label="Open menu"
          className="md:hidden h-10 w-10 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/30 -ml-2"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="hidden md:flex items-center gap-2 text-muted-foreground/70">
          <Search className="h-4 w-4" />
          <span className="text-[11px] uppercase tracking-[0.15em]">Search · Cmd K</span>
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        <NotificationBell />

        <DropdownMenu>
          <DropdownMenuTrigger
            className="inline-flex items-center gap-2.5 h-10 px-2 rounded-md hover:bg-accent/40 focus:outline-none focus:ring-2 focus:ring-ring/60 transition-colors"
          >
            <Avatar className="h-8 w-8 ring-2 ring-primary/40 ring-offset-2 ring-offset-background">
              <AvatarFallback className="text-xs bg-primary/15 text-primary font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="hidden md:flex flex-col items-start text-xs leading-tight">
              <span className="font-medium">{profile.full_name || profile.email.split('@')[0]}</span>
              <span className="text-muted-foreground uppercase tracking-[0.12em] text-[10px]">{roleLabel}</span>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal text-xs text-muted-foreground">
              {profile.email}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
