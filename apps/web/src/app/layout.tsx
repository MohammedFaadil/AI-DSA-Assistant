import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono, Manrope } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';

/**
 * next/font self-hosts and inlines these at build time — no runtime request to
 * Google, so there is nothing here for a CSP or an ad-blocker to break, and it
 * costs nothing extra on Vercel's free tier.
 *
 * Manrope: a geometric sans with real personality at display sizes (the
 * landing hero, stat numbers) while staying calm in UI copy — closer to what
 * Linear/Raycast use than the default system stack.
 * JetBrains Mono: ligatures and a tall x-height built for code, used in the
 * editor, every stat number, and anything reporting a metric.
 */
const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'AI DSA Mentor',
    template: '%s · AI DSA Mentor',
  },
  description:
    'A coding platform where the compiler is a mentor. Real-time guidance while you write, not a verdict after you finish.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  openGraph: {
    title: 'AI DSA Mentor',
    description: 'The compiler that teaches you while you type.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#08090c',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${manrope.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen bg-ink-950 font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
