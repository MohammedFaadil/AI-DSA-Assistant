'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Braces, Check, Loader2, X } from 'lucide-react';
import { ApiClientError } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';

const RULES = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'A lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { label: 'An uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'A number', test: (p: string) => /[0-9]/.test(p) },
];

export default function RegisterPage() {
  const router = useRouter();
  const register = useAuthStore((s) => s.register);
  const [form, setForm] = useState({ email: '', username: '', password: '', name: '' });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const allRulesPass = RULES.every((rule) => rule.test(form.password));

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await register({
        email: form.email,
        username: form.username,
        password: form.password,
        name: form.name || undefined,
      });
      router.push('/dashboard');
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'Could not create your account.',
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
          <h1 className="text-xl font-semibold tracking-tight">Create your account</h1>
          <p className="mt-1.5 text-sm text-ink-400">
            The mentor starts learning how you think from problem one.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="username" className="mb-1.5 block text-xs font-medium text-ink-300">
                  Username
                </label>
                <input
                  id="username"
                  required
                  minLength={3}
                  maxLength={24}
                  pattern="[A-Za-z0-9_]+"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  className="input"
                  placeholder="ada_l"
                />
              </div>
              <div>
                <label htmlFor="name" className="mb-1.5 block text-xs font-medium text-ink-300">
                  Name <span className="text-ink-500">(optional)</span>
                </label>
                <input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input"
                  placeholder="Ada"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-ink-300">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
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
                autoComplete="new-password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="input"
                placeholder="••••••••"
              />
              {form.password ? (
                <ul className="mt-2.5 grid grid-cols-2 gap-1.5">
                  {RULES.map((rule) => {
                    const ok = rule.test(form.password);
                    return (
                      <li
                        key={rule.label}
                        className={`flex items-center gap-1.5 text-[11px] ${
                          ok ? 'text-easy' : 'text-ink-400'
                        }`}
                      >
                        {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                        {rule.label}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>

            {error ? (
              <div
                role="alert"
                className="rounded-lg border border-hard/30 bg-hard/10 px-3.5 py-2.5 text-sm text-hard"
              >
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={pending || !allRulesPass}
              className="btn-primary w-full"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Create account
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-ink-400">
            Already have an account?{' '}
            <Link href="/login" className="link">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
