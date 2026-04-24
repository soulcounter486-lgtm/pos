import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'POS System',
  description: 'POS app with Vercel deployment and Supabase storage',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
