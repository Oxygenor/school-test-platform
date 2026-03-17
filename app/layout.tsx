import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'School Test Platform',
  description: 'Платформа для самостійних і контрольних робіт',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="uk">
      <body>{children}</body>
    </html>
  );
}