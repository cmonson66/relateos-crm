'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    router.push('/dashboard');
    router.refresh();
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + '/auth/callback' },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setMagicSent(true);
  }

  if (magicSent) {
    return (
      <div className="card-lit text-card-foreground rounded-md border border-border/40 relative">
        <div className="h-[3px] bg-primary glow-stripe rounded-t-md" />
        <div className="p-8 text-center">
          <h2 className="font-display text-3xl tracking-wider">CHECK YOUR EMAIL</h2>
          <p className="text-sm text-muted-foreground mt-3">
            Sign-in link sent to <strong className="text-card-foreground">{email}</strong>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card-lit text-card-foreground rounded-md border border-border/40 relative">
      <div className="h-[3px] bg-primary glow-stripe rounded-t-md" />
      <div className="p-8">
        <div className="flex flex-col items-center mb-7">
          <div className="w-14 h-14 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-display text-3xl mb-3 glow-halo">
            R
          </div>
          <h1 className="font-display text-3xl tracking-wider leading-none">RELATEOS CRM</h1>
          <p className="text-[10px] text-muted-foreground uppercase tracking-[0.25em] mt-2">
            Sales · Authorized Access
          </p>
        </div>

        <Tabs defaultValue="password" className="w-full flex flex-col gap-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="password">Password</TabsTrigger>
            <TabsTrigger value="magic">Magic link</TabsTrigger>
          </TabsList>
          <TabsContent value="password">
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email-pwd" className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Email</Label>
                <Input id="email-pwd" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Password</Label>
                <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" className="w-full font-display tracking-wider text-base h-11 btn-glow" disabled={loading}>
                {loading ? 'SIGNING IN...' : 'SIGN IN'}
              </Button>
            </form>
          </TabsContent>
          <TabsContent value="magic">
            <form onSubmit={handleMagicLink} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email-magic" className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Email</Label>
                <Input id="email-magic" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <Button type="submit" className="w-full font-display tracking-wider text-base h-11 btn-glow" disabled={loading}>
                {loading ? 'SENDING...' : 'SEND MAGIC LINK'}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
