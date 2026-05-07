export default function LockedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 md:p-8 bg-background">
      {children}
    </div>
  );
}
