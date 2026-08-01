'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Braces,
  Eye,
  Gauge,
  GitBranch,
  Lock,
  Sparkles,
  Terminal,
} from 'lucide-react';

const PILLARS = [
  {
    icon: Eye,
    title: 'It watches, it does not interrupt',
    body: 'Every two seconds your code is parsed, its complexity estimated and its algorithm identified — all deterministically, all free. The mentor speaks only when something is actually worth saying.',
  },
  {
    icon: Lock,
    title: 'It will not hand you the answer',
    body: 'A validator checks every response against the official solution before you ever see it. Not a prompt asking nicely — a mechanical check that discards and regenerates anything too close.',
  },
  {
    icon: Gauge,
    title: 'It knows when you are stuck',
    body: 'Idle time, rewrite churn, repeated errors and complexity plateaus each trigger a different specialist. Being stuck on a loop bound is a different problem from not knowing the technique.',
  },
  {
    icon: GitBranch,
    title: 'It remembers how you think',
    body: 'Topic mastery decays. Misconceptions are tracked by name. By your fortieth problem the mentor already knows you rush binary-search bounds and are strong on hashing.',
  },
];

const AGENTS = [
  ['Tutor', 'teaches the concept you are missing'],
  ['Hint', 'one rung of the ladder, never two'],
  ['Debug', 'translates the crash into English'],
  ['Complexity', 'proves your approach is too slow'],
  ['Code Review', 'once it works, makes it good'],
  ['Progress', 'tracks what you actually learned'],
];

export default function LandingPage() {
  return (
    <main className="relative overflow-hidden">
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-18rem] h-[36rem] w-[64rem] -translate-x-1/2 rounded-full bg-accent/10 blur-[140px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.035)_1px,transparent_0)] [background-size:32px_32px]" />
      </div>

      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 ring-1 ring-accent/30">
            <Braces className="h-4 w-4 text-accent-soft" />
          </div>
          <span className="text-[0.95rem] font-semibold tracking-tight">AI DSA Mentor</span>
        </div>
        <nav className="flex items-center gap-2">
          <Link href="/problems" className="btn-ghost">
            Problems
          </Link>
          <Link href="/login" className="btn-ghost">
            Sign in
          </Link>
          <Link href="/register" className="btn-primary">
            Get started
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-7xl px-6 pb-24 pt-16 sm:pt-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-3xl text-center"
        >
          <div className="chip mx-auto mb-6 border-accent/25 bg-accent/10 text-accent-soft">
            <Sparkles className="h-3.5 w-3.5" />
            The compiler becomes the mentor
          </div>

          <h1 className="text-balance text-4xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">
            Stop memorising solutions.
            <br />
            <span className="bg-gradient-to-r from-accent-soft via-accent to-accent-soft bg-clip-text text-transparent">
              Start understanding them.
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-ink-300">
            Every other platform tells you whether you were right. This one sits beside you while
            you type — reading your loops, estimating your complexity, noticing when you have been
            staring at line 14 for a minute — and says the smallest thing that moves you forward.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/register" className="btn-primary h-11 px-6 text-base">
              Start solving free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/problems" className="btn-outline h-11 px-6 text-base">
              Browse problems
            </Link>
          </div>

          <p className="mt-4 text-xs text-ink-400">
            No card. Runs entirely on free infrastructure.
          </p>
        </motion.div>

        {/* Editor mock */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto mt-16 max-w-5xl"
        >
          <div className="panel overflow-hidden">
            <div className="flex items-center gap-2 border-b border-ink-700/70 bg-ink-900/60 px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-hard/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-medium/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-easy/70" />
              <span className="ml-3 font-mono text-xs text-ink-400">two_sum.py</span>
              <span className="ml-auto chip border-medium/30 bg-medium/10 text-medium">
                <Gauge className="h-3 w-3" />
                O(n²) detected
              </span>
            </div>

            <div className="grid gap-0 md:grid-cols-[1fr_20rem]">
              <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-relaxed text-ink-200">
                <code>{`def twoSum(nums, target):
    for i in range(len(nums)):
        for j in range(i + 1, len(nums)):
            if nums[i] + nums[j] == target:
                return [i, j]
    return []`}</code>
              </pre>

              <aside className="space-y-3 border-t border-ink-700/70 bg-ink-900/40 p-4 md:border-l md:border-t-0">
                <div className="flex items-center gap-2 text-xs font-medium text-ink-300">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-accent" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                  </span>
                  Mentor · Complexity
                </div>
                <p className="text-sm leading-relaxed text-ink-200">
                  This works, and it will time out. With{' '}
                  <code className="rounded bg-ink-800 px-1 py-0.5 font-mono text-[0.8em] text-accent-soft">
                    n = 10⁴
                  </code>{' '}
                  you are doing about 50 million comparisons.
                </p>
                <p className="text-sm leading-relaxed text-ink-300">
                  Once you fix <code className="font-mono text-accent-soft">nums[i]</code>, the
                  partner you need is completely determined. What is it — and could you already know
                  whether you have seen it?
                </p>
                <div className="!mt-4 rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-xs text-ink-400">
                  Notice it did not say &ldquo;use a hash map&rdquo;.
                </div>
              </aside>
            </div>
          </div>
        </motion.div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-24">
        <div className="grid gap-4 md:grid-cols-2">
          {PILLARS.map((pillar, index) => (
            <motion.div
              key={pillar.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.4, delay: index * 0.06 }}
              className="panel p-6"
            >
              <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-accent/12 ring-1 ring-accent/25">
                <pillar.icon className="h-4.5 w-4.5 text-accent-soft" />
              </div>
              <h3 className="mb-2 text-base font-semibold">{pillar.title}</h3>
              <p className="text-sm leading-relaxed text-ink-300">{pillar.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-24">
        <div className="panel overflow-hidden p-8 sm:p-10">
          <div className="mb-8 max-w-2xl">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Seven specialists, not one chatbot
            </h2>
            <p className="mt-3 text-ink-300">
              A router picks the right expert for the situation. A hint request and a segfault are
              not the same problem, and they should not get the same voice.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {AGENTS.map(([name, role]) => (
              <div
                key={name}
                className="rounded-lg border border-ink-700/70 bg-ink-900/50 px-4 py-3.5 transition-colors hover:border-ink-600"
              >
                <div className="text-sm font-medium text-ink-100">{name}</div>
                <div className="mt-0.5 text-xs text-ink-400">{role}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-28">
        <div className="panel flex flex-col items-center gap-5 p-10 text-center sm:p-14">
          <Terminal className="h-8 w-8 text-accent-soft" />
          <h2 className="max-w-xl text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
            The next problem you solve should make the one after it easier.
          </h2>
          <Link href="/register" className="btn-primary h-11 px-6 text-base">
            Create your account
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-ink-800">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-ink-400 sm:flex-row">
          <span>AI DSA Mentor</span>
          <span className="text-xs">Built to teach, not to grade.</span>
        </div>
      </footer>
    </main>
  );
}
