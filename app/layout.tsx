import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Archivo } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';

const archivo = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],
  display: 'swap',
  variable: '--font-archivo',
});

export const metadata: Metadata = {
  title: 'MECSeater — Find your exam seat',
  description: 'Look up your exam room and seat number at Govt. Model Engineering College by roll number or name.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f3f4f1' },
    { media: '(prefers-color-scheme: dark)', color: '#0e1117' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
  return (
    <html lang="en" className={archivo.variable}>
      <body className="flex min-h-screen flex-col bg-background font-sans text-text antialiased">
        <Navbar />
        <div className="w-full flex-1">{children}</div>
        <Footer />
        <Analytics />
      </body>
    </html>
  );
}
