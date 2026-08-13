import type { Metadata } from 'next';
import { Geist, Geist_Mono, Bebas_Neue } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const bebas = Bebas_Neue({
  weight: '400',
  variable: '--font-bebas',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'RelateOS CRM',
  description: 'Sales CRM by RelateOS',
  formatDetection: { email: false, address: false, telephone: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={geistSans.variable + ' ' + geistMono.variable + ' ' + bebas.variable + ' antialiased'}>
        {children}
        <Toaster position="top-right" richColors closeButton theme="dark" />
      </body>
    </html>
  );
}
