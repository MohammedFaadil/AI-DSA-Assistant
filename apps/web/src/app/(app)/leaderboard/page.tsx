'use client';

import { useQuery } from '@tanstack/react-query';
import { Crown } from 'lucide-react';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';

interface Row {
  rank: number;
  username: string;
  name: string | null;
  score: number;
  solved: number;
  isCurrentUser: boolean;
}

export default function LeaderboardPage() {
  const leaderboard = useQuery({
    queryKey: ['leaderboard'],
    queryFn: () =>
      api.get<{ items: Row[]; total: number }>('/v1/leaderboard', {
        query: { scope: 'GLOBAL', page: 1, pageSize: 50 },
      }),
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Leaderboard</h1>
        <p className="mt-1 text-sm text-ink-400">
          Ranked by XP. Ranks are materialised on a schedule rather than aggregated per request.
        </p>
      </header>

      <div className="panel overflow-hidden">
        {leaderboard.isLoading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton h-9" />
            ))}
          </div>
        ) : leaderboard.data?.items.length ? (
          <ul className="divide-y divide-ink-800/70">
            {leaderboard.data.items.map((row) => (
              <li
                key={row.username}
                className={cn(
                  'flex items-center gap-4 px-5 py-3',
                  row.isCurrentUser && 'bg-accent/8',
                )}
              >
                <span
                  className={cn(
                    'w-8 text-sm tabular-nums',
                    row.rank <= 3 ? 'font-semibold text-medium' : 'text-ink-500',
                  )}
                >
                  {row.rank <= 3 ? <Crown className="h-4 w-4" /> : row.rank}
                </span>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-700 text-[10px] font-semibold uppercase">
                  {row.username.slice(0, 2)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {row.name ?? row.username}
                    {row.isCurrentUser ? (
                      <span className="ml-2 text-[10px] text-accent-soft">you</span>
                    ) : null}
                  </span>
                  <span className="text-xs text-ink-500">@{row.username}</span>
                </span>
                <span className="text-sm tabular-nums text-ink-300">{row.solved} solved</span>
                <span className="w-16 text-right text-sm font-semibold tabular-nums">
                  {row.score}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-16 text-center text-sm text-ink-500">
            No one has earned XP yet. Be first.
          </p>
        )}
      </div>
    </div>
  );
}
