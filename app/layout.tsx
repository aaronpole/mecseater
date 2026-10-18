import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'mecseater',
  description: 'Student seating lookup for exam rooms',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
