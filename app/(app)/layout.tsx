import { getUser } from '@/lib/auth/get-user';
import { AppShell } from '@/components/app/app-shell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await getUser();
  return <AppShell profile={profile}>{children}</AppShell>;
}
