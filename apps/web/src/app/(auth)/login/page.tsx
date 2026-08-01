'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Braces, Loader2 } from 'lucide-react';
import { ApiClientError } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'Could not sign in. Please try again.',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[28rem] w-[40rem] -translate-x-1/2 rounded-full bg-accent/10 blur-[120px]" />
      </div>

      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 ring-1 ring-accent/30">
            <Braces className="h-4 w-4 text-accent-soft" />
          </div>
          <span className="font-semibold tracking-tight">AI DSA Mentor</span>
        </Link>

        <div className="panel p-7">
          <h1 className="text-xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-1.5 text-sm text-ink-400">Pick up where you left off.</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-ink-300">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-ink-300">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
              />
            </div>

            {error ? (
              <div
                role="alert"
                className="rounded-lg border border-hard/30 bg-hard/10 px-3.5 py-2.5 text-sm text-hard"
              >
                {error}
              </div>
            ) : null}

            <button type="submit" disabled={pending} className="btn-primary w-full">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Sign in
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-ink-400">
            New here?{' '}
            <Link href="/register" className="link">
              Create an account
            </Link>
          </p>
        </div>

        <div className="mt-4 rounded-lg border border-ink-800 bg-ink-900/50 px-4 py-3 text-xs text-ink-400">
          <span className="font-medium text-ink-300">Seeded demo account</span>
          <div className="mt-1 font-mono">demo@aidsamentor.dev · Demo123!</div>
        </div>
      </div>
    </main>
  );
}
