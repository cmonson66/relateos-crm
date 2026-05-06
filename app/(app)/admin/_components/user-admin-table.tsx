'use client';

import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { initials, formatRelative } from '@/lib/utils/format';
import { updateUser } from '../actions';

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: 'super_admin' | 'admin' | 'manager' | 'rep';
  manager_id: string | null;
  is_active: boolean;
  created_at: string;
};

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  manager: 'Manager',
  rep: 'Rep',
};

export function UserAdminTable({
  profiles,
  currentUserId,
  currentRole,
}: {
  profiles: Profile[];
  currentUserId: string;
  currentRole: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    if (!search.trim()) return profiles;
    const q = search.toLowerCase();
    return profiles.filter(p =>
      (p.full_name || '').toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q)
    );
  }, [profiles, search]);

  const managerCandidates = profiles.filter(p =>
    p.role === 'manager' || p.role === 'admin' || p.role === 'super_admin'
  );

  function patch(id: string, updates: Parameters<typeof updateUser>[1]) {
    setPendingId(id);
    startTransition(async () => {
      try {
        await updateUser(id, updates);
        toast.success('Updated');
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed');
      } finally {
        setPendingId(null);
      }
    });
  }

  return (
    <>
      <div className="mb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <Input
          placeholder="Search users…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="md:max-w-xs"
        />
        <Button variant="outline" disabled className="font-display tracking-wider">
          + Invite User (coming Day 6)
        </Button>
      </div>

      {/* DESKTOP TABLE */}
      <div className="hidden md:block card-lit border border-border/40 rounded-md overflow-hidden">
        <div className="grid grid-cols-[2fr_1fr_1.2fr_0.8fr_0.8fr] items-center gap-4 px-5 py-3 text-[10px] uppercase tracking-[0.15em] text-muted-foreground border-b border-border/40 bg-background/30">
          <div>User</div>
          <div>Role</div>
          <div>Manager</div>
          <div>Status</div>
          <div className="text-right">Joined</div>
        </div>
        {filtered.map(p => {
          const isSelf = p.id === currentUserId;
          const isPending = pendingId === p.id;
          const managerName = profiles.find(m => m.id === p.manager_id)?.full_name;
          return (
            <div key={p.id} className="grid grid-cols-[2fr_1fr_1.2fr_0.8fr_0.8fr] items-center gap-4 px-5 py-4 border-b border-border/20 last:border-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-primary/15 text-primary text-xs font-medium flex items-center justify-center shrink-0">
                  {initials(p.full_name, p.email)}
                </div>
                <div className="min-w-0">
                  <div className="font-medium truncate">
                    {p.full_name || p.email.split('@')[0]}
                    {isSelf && <span className="ml-2 text-[10px] uppercase text-primary tracking-[0.15em]">you</span>}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{p.email}</div>
                </div>
              </div>

              <Select
                value={p.role}
                disabled={isPending || (isSelf && p.role === currentRole)}
                onValueChange={(v: string | null) => v && patch(p.id, { role: v as Profile['role'] })}
              >
                <SelectTrigger className="h-9"><span>{ROLE_LABELS[p.role]}</span></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rep">Rep</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  {currentRole === 'super_admin' && <SelectItem value="super_admin">Super Admin</SelectItem>}
                </SelectContent>
              </Select>

              <Select
                value={p.manager_id || 'none'}
                disabled={isPending}
                onValueChange={(v: string | null) => patch(p.id, { manager_id: !v || v === 'none' ? null : v })}
              >
                <SelectTrigger className="h-9">
                  <span className={managerName ? '' : 'text-muted-foreground'}>{managerName || 'No manager'}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {managerCandidates.filter(m => m.id !== p.id).map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.full_name || m.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <button
                type="button"
                disabled={isPending || isSelf}
                onClick={() => patch(p.id, { is_active: !p.is_active })}
                className={`inline-flex items-center justify-center px-2.5 py-1 rounded-md text-[10px] uppercase tracking-[0.12em] border transition-colors min-h-[32px] ${
                  p.is_active
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/15'
                    : 'border-muted-foreground/30 bg-muted/30 text-muted-foreground hover:bg-muted/50'
                } ${isSelf ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                {p.is_active ? 'Active' : 'Inactive'}
              </button>

              <div className="text-xs text-muted-foreground text-right tabular-nums">
                {formatRelative(p.created_at)}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">
            No users match.
          </div>
        )}
      </div>

      {/* MOBILE CARDS */}
      <div className="md:hidden space-y-3">
        {filtered.map(p => {
          const isSelf = p.id === currentUserId;
          const isPending = pendingId === p.id;
          const managerName = profiles.find(m => m.id === p.manager_id)?.full_name;
          return (
            <div key={p.id} className="card-lit border border-border/40 rounded-md p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/15 text-primary text-xs font-medium flex items-center justify-center shrink-0">
                  {initials(p.full_name, p.email)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium leading-tight truncate">
                    {p.full_name || p.email.split('@')[0]}
                    {isSelf && <span className="ml-2 text-[10px] uppercase text-primary tracking-[0.15em]">you</span>}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">{p.email}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-1">Role</div>
                  <Select
                    value={p.role}
                    disabled={isPending || (isSelf && p.role === currentRole)}
                    onValueChange={(v: string | null) => v && patch(p.id, { role: v as Profile['role'] })}
                  >
                    <SelectTrigger className="h-9"><span>{ROLE_LABELS[p.role]}</span></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rep">Rep</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      {currentRole === 'super_admin' && <SelectItem value="super_admin">Super Admin</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-1">Manager</div>
                  <Select
                    value={p.manager_id || 'none'}
                    disabled={isPending}
                    onValueChange={(v: string | null) => patch(p.id, { manager_id: !v || v === 'none' ? null : v })}
                  >
                    <SelectTrigger className="h-9">
                      <span className={managerName ? '' : 'text-muted-foreground'}>{managerName || 'None'}</span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {managerCandidates.filter(m => m.id !== p.id).map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.full_name || m.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  disabled={isPending || isSelf}
                  onClick={() => patch(p.id, { is_active: !p.is_active })}
                  className={`inline-flex items-center justify-center px-3 py-1.5 rounded-md text-[10px] uppercase tracking-[0.12em] border transition-colors min-h-[32px] ${
                    p.is_active
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                      : 'border-muted-foreground/30 bg-muted/30 text-muted-foreground'
                  } ${isSelf ? 'cursor-not-allowed opacity-60' : ''}`}
                >
                  {p.is_active ? 'Active' : 'Inactive'}
                </button>
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  joined {formatRelative(p.created_at)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
