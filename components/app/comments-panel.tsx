'use client';

import { useState, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatRelative, initials } from '@/lib/utils/format';
import { postComment } from '@/app/(app)/comments/actions';
import { AtSign } from 'lucide-react';

type EntityType = 'account' | 'contact' | 'deal' | 'activity' | 'task';

type Profile = { id: string; full_name: string | null; email: string };

type Comment = {
  id: string;
  body: string;
  mentions: string[];
  created_at: string;
  author: Profile | Profile[] | null;
};

export function CommentsPanel({
  entityType,
  entityId,
  comments,
  profiles,
  currentUserId,
}: {
  entityType: EntityType;
  entityId: string;
  comments: Comment[];
  profiles: Profile[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [mentionPickerOpen, setMentionPickerOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionedIds, setMentionedIds] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Pre-extract any @ mentions from text typed manually
  function extractMentions(text: string): string[] {
    const ids = new Set(mentionedIds);
    profiles.forEach(p => {
      const name = p.full_name || p.email.split('@')[0];
      if (text.includes('@' + name)) ids.add(p.id);
    });
    return Array.from(ids);
  }

  function handleBodyChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const newBody = e.target.value;
    setBody(newBody);
    // Detect "@" trigger at end of input
    const match = newBody.match(/@(\w*)$/);
    if (match) {
      setMentionQuery(match[1].toLowerCase());
      setMentionPickerOpen(true);
    } else {
      setMentionPickerOpen(false);
    }
  }

  function pickMention(p: Profile) {
    const name = p.full_name || p.email.split('@')[0];
    // Replace last @x with @Name + space
    const newBody = body.replace(/@(\w*)$/, '@' + name + ' ');
    setBody(newBody);
    setMentionedIds(ids => Array.from(new Set([...ids, p.id])));
    setMentionPickerOpen(false);
    textareaRef.current?.focus();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) {
      toast.error('Comment body required');
      return;
    }
    const mentions = extractMentions(body);
    startTransition(async () => {
      try {
        await postComment({
          entityType,
          entityId,
          body: body.trim(),
          mentions,
        });
        setBody('');
        setMentionedIds([]);
        toast.success(mentions.length ? `Commented · ${mentions.length} mentioned` : 'Commented');
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to post');
      }
    });
  }

  const filteredProfiles = profiles
    .filter(p => p.id !== currentUserId)
    .filter(p => {
      if (!mentionQuery) return true;
      const name = (p.full_name || p.email).toLowerCase();
      return name.includes(mentionQuery);
    })
    .slice(0, 6);

  return (
    <div>
      {/* Existing comments */}
      <div className="space-y-3 mb-5">
        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground italic py-2">
            No comments yet. Loop in a teammate with @name.
          </p>
        ) : (
          comments.map(c => {
            const author = Array.isArray(c.author) ? c.author[0] : c.author;
            return (
              <div key={c.id} className="flex items-start gap-3 p-3 rounded-md border border-border/30 bg-background/30">
                <div className="w-8 h-8 rounded-full bg-primary/15 text-primary text-[10px] font-medium flex items-center justify-center shrink-0">
                  {initials(author?.full_name, author?.email)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-3 mb-1">
                    <span className="text-xs font-medium">
                      {author?.full_name || author?.email?.split('@')[0] || 'Someone'}
                    </span>
                    <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                      {formatRelative(c.created_at)}
                    </span>
                  </div>
                  <div className="text-sm whitespace-pre-wrap break-words">
                    <CommentBody body={c.body} />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Composer */}
      <form onSubmit={handleSubmit} className="space-y-2 relative">
        <textarea
          ref={textareaRef}
          value={body}
          onChange={handleBodyChange}
          placeholder="Add a comment… use @ to mention a teammate"
          rows={3}
          className="w-full px-3 py-2 rounded-md border border-border/40 bg-input/50 text-sm focus:outline-none focus:ring-2 focus:ring-ring/60 resize-y"
        />

        {/* Mention picker */}
        {mentionPickerOpen && filteredProfiles.length > 0 && (
          <div className="absolute z-20 left-0 right-0 -top-2 -translate-y-full bg-popover border border-border/40 rounded-md shadow-2xl shadow-black/40 overflow-hidden max-h-[240px] overflow-y-auto">
            {filteredProfiles.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => pickMention(p)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-primary/10 transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-primary/15 text-primary text-[10px] font-medium flex items-center justify-center shrink-0">
                  {initials(p.full_name, p.email)}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{p.full_name || p.email.split('@')[0]}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{p.email}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground inline-flex items-center gap-1">
            <AtSign className="h-3 w-3" /> mention to notify
          </span>
          <Button type="submit" disabled={pending} className="font-display tracking-wider btn-glow h-9">
            {pending ? '...' : 'POST'}
          </Button>
        </div>
      </form>
    </div>
  );
}

function CommentBody({ body }: { body: string }) {
  // Render @Name in primary color — purely cosmetic, mentions[] in DB is the source of truth
  const parts = body.split(/(@\w+(?:\s\w+)?)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('@')
          ? <span key={i} className="text-primary font-medium">{p}</span>
          : <span key={i}>{p}</span>
      )}
    </>
  );
}
