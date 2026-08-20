'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { AlertTriangle, ArrowRight, Trash2 } from 'lucide-react';
import { previewDeleteUser, deleteUser, type DeletePreview } from '../actions';

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
};

export function DeleteUserDialog({
  open,
  onClose,
  targetUser,
  successorCandidates,
}: {
  open: boolean;
  onClose: () => void;
  targetUser: Profile | null;
  successorCandidates: Profile[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<DeletePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [successorId, setSuccessorId] = useState<string>('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [step, setStep] = useState<'preview' | 'confirm'>('preview');

  // Load preview when dialog opens with a target
  useEffect(() => {
    if (!open || !targetUser) return;
    setPreview(null);
    setPreviewError(null);
    setSuccessorId('');
    setConfirmEmail('');
    setStep('preview');
    startTransition(async () => {
      try {
        const res = await previewDeleteUser(targetUser.id);
        setPreview(res);
        setSuccessorId(res.defaultSuccessorId || '');
      } catch (err) {
        setPreviewError(err instanceof Error ? err.message : 'Failed to load preview');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, targetUser?.id]);

  if (!targetUser) return null;

  const fullName = targetUser.full_name || targetUser.email.split('@')[0];
  const totalRecords = preview
    ? preview.accountsCount + preview.contactsCount + preview.dealsCount + preview.activitiesCount + preview.terminalsCount
    : 0;

  const successorCandidatesFiltered = successorCandidates.filter(p => p.id !== targetUser.id);
  const successorLabel = successorCandidatesFiltered.find(p => p.id === successorId);
  const successorName = successorLabel
    ? (successorLabel.full_name || successorLabel.email.split('@')[0])
    : null;

  const canProceed = !!successorId && !!preview;
  const canConfirm = confirmEmail.trim().toLowerCase() === targetUser.email.toLowerCase();

  function handleDelete() {
    if (!canConfirm) return;
    startTransition(async () => {
      try {
        const result = await deleteUser({
          targetId: targetUser!.id,
          successorId,
          confirmEmail,
        });
        if (result.ok === false) {
          // Real reason, on screen, for as long as it takes to read a
          // constraint name.
          toast.error(result.message, { duration: 12000 });
          return;
        }
        const { reassigned } = result;
        toast.success(
          `Deleted. Transferred ${reassigned.accounts} account${reassigned.accounts === 1 ? '' : 's'}, ${reassigned.contacts} contact${reassigned.contacts === 1 ? '' : 's'}, ${reassigned.deals} deal${reassigned.deals === 1 ? '' : 's'} to ${successorName}.`,
          { duration: 6000 }
        );
        onClose();
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Delete failed');
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        {previewError ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-display tracking-wider text-2xl text-destructive">CAN&apos;T DELETE</DialogTitle>
              <DialogDescription>{previewError}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={onClose}>Close</Button>
            </DialogFooter>
          </>
        ) : !preview ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-display tracking-wider text-2xl">LOADING…</DialogTitle>
              <DialogDescription>Tallying their records.</DialogDescription>
            </DialogHeader>
          </>
        ) : step === 'preview' ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-display tracking-wider text-2xl">DELETE USER</DialogTitle>
              <DialogDescription>
                You&apos;re about to permanently delete <strong className="text-foreground">{fullName}</strong> ({preview.targetEmail}). All their records will be transferred to a successor.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4">
              <div className="bg-background/50 border border-border/40 rounded-md p-4 space-y-2">
                <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                  They own {totalRecords} record{totalRecords === 1 ? '' : 's'}
                </div>
                <div className="grid grid-cols-2 gap-y-1 text-sm">
                  <span className="text-muted-foreground">Accounts</span>
                  <span className="text-right tabular-nums">{preview.accountsCount}</span>
                  <span className="text-muted-foreground">Contacts</span>
                  <span className="text-right tabular-nums">{preview.contactsCount}</span>
                  <span className="text-muted-foreground">Deals</span>
                  <span className="text-right tabular-nums">{preview.dealsCount}</span>
                  <span className="text-muted-foreground">Activities</span>
                  <span className="text-right tabular-nums">{preview.activitiesCount}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                  Transfer everything to *
                </Label>
                <Select
                  value={successorId || 'none'}
                  onValueChange={(v: string | null) => setSuccessorId(!v || v === 'none' ? '' : v)}
                >
                  <SelectTrigger>
                    <span className={successorName ? '' : 'text-muted-foreground'}>
                      {successorName || 'Select successor…'}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Select successor —</SelectItem>
                    {successorCandidatesFiltered.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name || p.email.split('@')[0]}
                        {p.id === preview.defaultSuccessorId && ' · their manager'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {preview.defaultSuccessorId && successorId === preview.defaultSuccessorId && (
                  <p className="text-[11px] text-muted-foreground">
                    Default — they were the manager of this user.
                  </p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button
                type="button"
                onClick={() => setStep('confirm')}
                disabled={!canProceed}
                className="font-display tracking-wider"
              >
                NEXT <ArrowRight className="h-3.5 w-3.5 ml-2" />
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="font-display tracking-wider text-2xl text-destructive">CONFIRM DELETE</DialogTitle>
              <DialogDescription>
                This is permanent. {fullName}&apos;s account, login, and profile will be removed from Supabase entirely. {totalRecords} record{totalRecords === 1 ? ' goes' : 's go'} to {successorName}.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-3">
              <div className="bg-destructive/10 border border-destructive/30 rounded-md p-3 flex gap-3 text-sm">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <div className="text-muted-foreground">
                  Type <strong className="text-foreground font-mono">{preview.targetEmail}</strong> below to confirm.
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                  Type the email to confirm
                </Label>
                <Input
                  value={confirmEmail}
                  onChange={e => setConfirmEmail(e.target.value)}
                  placeholder={preview.targetEmail}
                  autoFocus
                  autoComplete="off"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setStep('preview')}>Back</Button>
              <Button
                type="button"
                onClick={handleDelete}
                disabled={!canConfirm || pending}
                variant="destructive"
                className="font-display tracking-wider"
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" />
                {pending ? 'DELETING…' : 'DELETE PERMANENTLY'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
