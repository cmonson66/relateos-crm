import { BackLink } from '@/components/app/back-link';
import { getUser } from '@/lib/auth/get-user';
import { PageHeader } from '@/components/app/page-header';
import { ImportWizard } from './_components/import-wizard';

export default async function ImportPage() {
  // The nav hides this from reps, but a typed URL doesn't care
  const { profile } = await getUser();
  // Reps import their own cold lists. They cannot hand rows to someone else,
  // so the ownership picker is hidden and the server forces them as owner.
  const isLead = ['super_admin', 'admin', 'manager'].includes(profile.role);

  return (
    <div className="p-8 max-w-5xl">
      <BackLink fallbackHref="/dashboard" fallbackLabel="Dashboard" />

      <PageHeader
        kicker="Bulk operations"
        title="Import"
        highlight="Data"
        description="Upload a CSV to bring contacts and accounts in. Your existing column names are auto-detected when possible."
      />
      <ImportWizard isLead={isLead} />
    </div>
  );
}
