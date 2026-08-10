// Which contact is the person a rep should ask for.
//
// Shops often carry a placeholder contact (title 'Business', first name =
// the shop name) created by the import or the Places bridge. A real human
// added later can sort AFTER it, so "first contact by created_at" was
// picking the placeholder and the sheet fell back to "the owner".
export type ContactLike = {
  id?: string;
  first_name: string | null;
  last_name?: string | null;
  title?: string | null;
  phone?: string | null;
  legacy_id?: string | null;
};

export function isRealPerson(c: ContactLike, accountName: string): boolean {
  const first = (c.first_name ?? '').trim();
  if (!first) return false;
  if ((c.title ?? '').toLowerCase() === 'business') return false;
  // A placeholder carries the shop's own name
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (norm(first) === norm(accountName)) return false;
  if (norm(accountName).startsWith(norm(first)) && first.length > 6) return false;
  return true;
}

/** The human to ask for, or null if we only have a placeholder. */
export function pickPerson<T extends ContactLike>(contacts: T[], accountName: string): T | null {
  const people = contacts.filter(c => isRealPerson(c, accountName));
  if (people.length === 0) return null;
  // Prefer one with a phone number - that is the one a rep can actually use
  return people.find(c => c.phone) ?? people[0];
}

/** The contact that carries the lead key, for intel lookups. */
export function pickLeadContact<T extends ContactLike>(contacts: T[]): T | null {
  return contacts.find(c => c.legacy_id) ?? contacts[0] ?? null;
}
