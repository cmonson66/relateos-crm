'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Copy, Check, UserPlus, Mail } from 'lucide-react';
import { generateInviteLink } from '../actions';

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  manager: 'Manager',
  rep: 'Rep',
};

export function InviteUserDialog({
  currentRole,
  inviterName,
  managerCandidates,
}: {
  currentRole: string;
  inviterName: string;
  managerCandidates: { id: string; full_name: string | null; email: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'super_admin' | 'admin' | 'manager' | 'rep'>('rep');
  const [managerId, setManagerId] = useState<string>('');
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [generatedEmail, setGeneratedEmail] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const managerLabel = managerCandidates.find(m => m.id === managerId);

  function reset() {
    setEmail('');
    setFullName('');
    setRole('rep');
    setManagerId('');
    setGeneratedUrl(null);
    setGeneratedEmail(null);
    setCopied(false);
  }

  function handleClose() {
    setOpen(false);
    setTimeout(reset, 200);
    router.refresh();
  }

  function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return toast.error('Email is required');
    if (!fullName.trim()) return toast.error('Full name is required');

    startTransition(async () => {
      try {
        const res = await generateInviteLink({
          email: email.trim(),
          fullName: fullName.trim(),
          role,
          managerId: managerId || null,
        });
        setGeneratedUrl(res.inviteUrl);
        setGeneratedEmail(res.email);
        toast.success('Invite link generated');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to generate link');
      }
    });
  }

  async function handleCopy() {
    if (!generatedUrl) return;
    try {
      await navigator.clipboard.writeText(generatedUrl);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Copy failed - select the URL and copy manually');
    }
  }

  function handleEmail() {
    if (!generatedUrl || !generatedEmail) return;
    const firstName = fullName.trim().split(/\s+/)[0] || '';
    const roleLabel = ROLE_LABELS[role] || role;

    const subject = firstName
      ? `${firstName}, you\'ve been added to ProtosEQ CRM`
      : `You\'ve been added to ProtosEQ CRM`;

    const greeting = firstName ? `Hi ${firstName},` : 'Hi,';

    const body =
      `${greeting}\n\n` +
      `You\'ve been added to ProtosEQ CRM as a ${roleLabel}. Click this link to set up your account:\n\n` +
      `${generatedUrl}\n\n` +
      `The link expires in 24 hours. Once you\'ve set your password, you can sign in anytime at https://protoseq-crm.vercel.app/login\n\n` +
      `Let me know if you have any trouble getting in.\n\n` +
      `- ${inviterName}`;

    const mailto = `mailto:${encodeURIComponent(generatedEmail)}` +
      `?subject=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`;

    window.location.href = mailto;
    toast.success('Opening your email app');
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setTimeout(reset, 200); }}>
      <DialogTrigger className="inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2 font-display tracking-wider btn-glow">
        <UserPlus className="h-3.5 w-3.5" /> Invite User
      </DialogTrigger>
      <DialogContent className="max-w-md">
        {!generatedUrl ? (
          <form onSubmit={handleGenerate}>
            <DialogHeader>
              <DialogTitle className="font-display tracking-wider text-2xl">INVITE USER</DialogTitle>
              <DialogDescription>
                Generates a one-time signup link. Send via email, Slack, or text - they\'ll click it once to set up their account.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="invite-name" className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                  Full name *
                </Label>
                <Input
                  id="invite-name"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Anya Sharma"
                  autoFocus
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-email" className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                  Email *
                </Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="anya@protoseq.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Role</Label>
                <Select
                  value={role}
                  onValueChange={(v: string | null) => v && setRole(v as typeof role)}
                >
                  <SelectTrigger><span>{ROLE_LABELS[role]}</span></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rep">Rep</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    {currentRole === 'super_admin' && <SelectItem value="super_admin">Super Admin</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Manager (optional)</Label>
                <Select
                  value={managerId || 'none'}
                  onValueChange={(v: string | null) => setManagerId(!v || v === 'none' ? '' : v)}
                >
                  <SelectTrigger>
                    <span className={managerLabel ? '' : 'text-muted-foreground'}>
                      {managerLabel?.full_name || managerLabel?.email || 'No manager'}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">- None -</SelectItem>
                    {managerCandidates.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.full_name || m.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={pending} className="font-display tracking-wider btn-glow">
                {pending ? 'GENERATING...' : 'GENERATE LINK'}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="font-display tracking-wider text-2xl">INVITE READY</DialogTitle>
              <DialogDescription>
                Send this link to <strong className="text-foreground">{generatedEmail}</strong>. It expires in 24 hours and can only be used once.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-3">
              <div className="bg-background/50 border border-border/40 rounded-md p-3 break-all text-xs font-mono text-muted-foreground select-all max-h-32 overflow-y-auto">
                {generatedUrl}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCopy}
                  className="font-display tracking-wider"
                >
                  {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                  {copied ? 'COPIED' : 'COPY LINK'}
                </Button>
                <Button
                  type="button"
                  onClick={handleEmail}
                  className="font-display tracking-wider btn-glow"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  SEND EMAIL
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground text-center">
                <strong className="text-foreground">Send email</strong> opens your default mail app with the message pre-filled. <strong className="text-foreground">Copy link</strong> for Slack or text.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" onClick={handleClose} className="font-display tracking-wider">DONE</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
