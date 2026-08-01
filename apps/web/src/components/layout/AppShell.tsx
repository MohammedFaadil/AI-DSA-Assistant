'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import {
  Award,
  Braces,
  Building2,
  Flame,
  LayoutDashboard,
  Library,
  ListChecks,
  LogOut,
  Map as MapIcon,
  Sparkles,
  Trophy,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/problems', label: 'Problems', icon: ListChecks },
  { href: '/companies', label: 'Companies', icon: Building2 },
  { href: '/practice', label: 'Practice Zone', icon: Sparkles },
  { href: '/curriculum', label: 'Curriculum', icon: MapIcon },
  { href: '/library', label: 'Library', icon: Library },
  { href: '/progress', label: 'Progress', icon: TrendingUp },
  { href: '/achievements', label: 'Achievements', icon: Award },
  { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, status, logout } = useAuthStore();

  useEffect(() => {
    if (status === 'anonymous') router.replace('/login');
  }, [status, router]);

  if (status === 'loading' || status === 'idle') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="skeleton h-9 w-40" />
      </div>
    );
  }
  if (!user) return null;

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-ink-800 bg-ink-900/40 lg:flex">
        <Link href="/dashboard" className="flex items-center gap-2.5 px-5 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 ring-1 ring-accent/30">
            <Braces className="h-4 w-4 text-accent-soft" />
          </div>
          <span className="text-sm font-semibold tracking-tight">AI DSA Mentor</span>
        </Link>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
          {NAV.map((item) => {
            const active = item.href === '/dashboard' ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors',
                  active
                    ? 'bg-accent/12 font-medium text-accent-soft'
                    : 'text-ink-300 hover:bg-ink-800 hover:text-ink-100',
                )}
              >
                {active ? (
                  <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-accent" />
                ) : null}
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-ink-800 p-3">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-700 text-xs font-semibold uppercase">
              {user.username.slice(0, 2)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{user.name ?? user.username}</div>
              <div className="flex items-center gap-1 text-[11px] text-ink-400">
                <Flame className="h-3 w-3 text-medium" />
                {user.streak?.current ?? 0}-day streak
              </div>
            </div>
            <button
              onClick={() => void logout()}
              className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-200"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-40 flex items-center gap-1 overflow-x-auto border-b border-ink-800 bg-ink-900/90 px-3 py-2 backdrop-blur lg:hidden">
        <Link href="/dashboard" className="mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/15">
          <Braces className="h-3.5 w-3.5 text-accent-soft" />
        </Link>
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'shrink-0 rounded-md p-2 transition-colors',
              pathname.startsWith(item.href) ? 'text-accent-soft' : 'text-ink-400',
            )}
            aria-label={item.label}
          >
            <item.icon className="h-4 w-4" />
          </Link>
        ))}
      </div>

      <main className="min-w-0 flex-1 pt-12 lg:pt-0">{children}</main>
    </div>
  );
}
