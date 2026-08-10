import { PlaybookView } from './_components/playbook-view';

export const dynamic = 'force-static';

// The master walk-in script - the one reps memorize. Lives in the app so
// it is never a stale PDF in somebody's texts, and prints from any phone.
export default function PlaybookPage() {
  return <PlaybookView />;
}
