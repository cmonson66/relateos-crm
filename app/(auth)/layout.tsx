export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
      <div className="w-full max-w-md relative z-10">
        {children}
      </div>
      <p className="mt-8 text-[10px] uppercase tracking-[0.25em] text-muted-foreground relative z-10">
        Monson Development
      </p>
    </div>
  );
}
