import { PageHeader } from '@/components/app/page-header';
import { ImportWizard } from './_components/import-wizard';

export default function ImportPage() {
  return (
    <div className="p-8 max-w-5xl">
      <PageHeader
        kicker="Bulk operations"
        title="Import"
        highlight="Data"
        description="Upload a CSV to bring contacts and accounts in. Your existing column names are auto-detected when possible."
      />
      <ImportWizard />
    </div>
  );
}
