import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Meta Rankings',
  description: 'Live race rankings and statistics',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}