import { getUser } from '@/lib/auth/get-user';
import { Sidebar } from '@/components/app/sidebar';
import { Header } from '@/components/app/header';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await getUser();

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar profile={profile} />
      <div className="flex flex-1 flex-col min-w-0">
        <Header profile={profile} />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
