import { getUser } from '@/lib/auth/get-user';

export default async function DashboardPage() {
  const { profile } = await getUser();
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  }).toUpperCase();
  const time = new Date().toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit',
  });
  const firstName = profile.full_name?.split(' ')[0] || profile.email.split('@')[0];

  return (
    <div className="p-8 max-w-7xl">
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          <span className="inline-block w-2 h-2 bg-primary rounded-full hud-pulse" />
          <span>Live · {today} · {time}</span>
        </div>
        <h1 className="font-display text-6xl tracking-wider leading-none">
          WELCOME BACK,{' '}
          <span className="text-primary text-glow-primary">{firstName.toUpperCase()}</span>
        </h1>
        <p className="text-muted-foreground mt-3 max-w-2xl">
          Day 2 placeholder. Real KPIs and pipeline visualization ship Day 3.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <KpiCard label="Role" value={profile.role.replace('_', ' ')} accent />
        <KpiCard label="Status" value="Authenticated" />
        <KpiCard label="Organization" value="ProtosEQ" />
      </div>

      <div className="card-lit text-card-foreground rounded-md border border-border/40 relative">
        <div className="h-[2px] bg-primary glow-stripe rounded-t-md" />
        <div className="p-6">
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-4">
            Coming Day 3
          </div>
          <div className="grid grid-cols-2 gap-x-12 gap-y-3 text-sm">
            <div className="flex items-baseline gap-3">
              <span className="font-display text-2xl text-primary leading-none">01</span>
              <span>Accounts management</span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="font-display text-2xl text-primary leading-none">02</span>
              <span>Contacts CRUD + bulk import</span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="font-display text-2xl text-primary leading-none">03</span>
              <span>Deals + pipeline kanban</span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="font-display text-2xl text-primary leading-none">04</span>
              <span>Activity logging + scheduling</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="card-lit text-card-foreground rounded-md border border-border/40 relative">
      <div
        className={
          accent
            ? 'h-[3px] bg-primary glow-stripe rounded-t-md'
            : 'h-[3px] bg-card-foreground/10 rounded-t-md'
        }
      />
      <div className="p-5">
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">
          {label}
        </div>
        <div className="font-display text-3xl tracking-wider capitalize leading-none">
          {value}
        </div>
      </div>
    </div>
  );
}
