import './globals.css';
import type { Metadata } from 'next';
import LanguageProvider from '@/components/LanguageProvider';

export const metadata: Metadata = {
  title: 'POS System',
  description: 'POS app with Vercel deployment and Supabase storage',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
