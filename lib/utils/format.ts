export const APP_TIMEZONE = 'America/Phoenix';

export function formatRelative(date: string | Date | null): string {
  if (!date) return 'never';
  const d = typeof date === 'string' ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)}w ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: APP_TIMEZONE });
}

export function formatDate(date: string | Date | null): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: APP_TIMEZONE });
}

export function initials(name: string | null | undefined, email?: string): string {
  const source = name || email || '?';
  return source
    .split(/[\s@]+/)
    .filter(Boolean)
    .map(s => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
