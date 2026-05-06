import { PageHeader } from '@/components/app/page-header';
import { ChangePasswordForm } from './_components/change-password-form';

export default function ChangePasswordPage() {
  return (
    <div className="p-4 md:p-8 max-w-xl">
      <PageHeader
        kicker="Account"
        title="Change"
        highlight="Password"
        description="Update your password. You\'ll stay signed in on this device."
      />
      <ChangePasswordForm />
    </div>
  );
}
