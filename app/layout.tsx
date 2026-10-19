import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';

export const metadata: Metadata = {
  title: 'MECSeater — Student Exam Seating Lookup',
  description: 'Instant exam hall and seat allocation lookup for students.',
};

export const viewport: Viewport = {
  themeColor: '#090909',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="flex min-h-screen flex-col bg-[#090909] text-white font-sans antialiased selection:bg-white selection:text-[#090909]">
        <Navbar />
        <div className="flex-1 w-full">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
