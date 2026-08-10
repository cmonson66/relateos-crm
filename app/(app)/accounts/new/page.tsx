import { PageHeader } from '@/components/app/page-header';
import { BackLink } from '@/components/app/back-link';
import { AccountForm } from '../_components/account-form';

export default function NewAccountPage() {
  return (
    <div className="p-8 max-w-3xl">
      <BackLink fallbackHref="/accounts" fallbackLabel="All accounts" />

      <PageHeader
        kicker="New record"
        title="Add"
        highlight="Account"
        description="Companies, athletic programs, departments — anything you sell to."
      />
      <AccountForm />
    </div>
  );
}
