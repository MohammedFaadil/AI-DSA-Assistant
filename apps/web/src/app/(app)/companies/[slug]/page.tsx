'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bookmark, BookmarkCheck, Building2, Check, Info, Lightbulb, ListChecks } from 'lucide-react';
import type { CompanyProfileDto } from '@repo/contracts';
import { api } from '@/lib/api-client';
import { DIFFICULTY_STYLES, cn } from '@/lib/utils';
import { SectionHeading } from '@/components/ui/primitives';

const DIFFICULTY_ORDER = ['EASY', 'MEDIUM', 'HARD'] as const;

export default function CompanyProfilePage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const queryClient = useQueryClient();

  const profile = useQuery({
    queryKey: ['company', slug],
    queryFn: () => api.get<CompanyProfileDto>(`/v1/companies/${slug}`),
  });

  const toggleSave = useMutation({
    mutationFn: () =>
      profile.data?.isSaved
        ? api.delete(`/v1/library/companies/${slug}`)
        : api.post(`/v1/library/companies/${slug}`, {}),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['company', slug] }),
  });

  if (profile.isLoading || !profile.data) {
    return (
      <div className="page-container">
        <div className="skeleton h-32" />
      </div>
    );
  }

  const data = profile.data;
  const grouped = DIFFICULTY_ORDER.map((difficulty) => ({
    difficulty,
    questions: data.questions.filter((q) => q.difficulty === difficulty),
  })).filter((g) => g.questions.length > 0);

  return (
    <div className="page-container">
      <SectionHeading
        eyebrow="Company prep"
        title={data.name}
        description="General interview-process guidance, framed honestly — not verified insider information — plus a curated question set from this platform's own company tags."
        action={
          <button
            onClick={() => toggleSave.mutate()}
            disabled={toggleSave.isPending}
            className={cn('btn-outline text-xs', data.isSaved && 'border-accent/50 text-accent-soft')}
          >
            {data.isSaved ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
            {data.isSaved ? 'Saved' : 'Save to Library'}
          </button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <div className="space-y-4">
          {data.overview ? (
            <section className="panel p-5">
              <h2 className="card-title mb-2 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-accent-soft" />
                Overview
              </h2>
              <p className="text-[13.5px] leading-relaxed text-ink-300">{data.overview}</p>
            </section>
          ) : null}

          {data.interviewProcess ? (
            <section className="panel p-5">
              <h2 className="card-title mb-2 flex items-center gap-2">
                <Info className="h-4 w-4 text-accent-soft" />
                Interview process
              </h2>
              <p className="text-[13.5px] leading-relaxed text-ink-300">{data.interviewProcess}</p>
            </section>
          ) : null}

          {data.prepTips ? (
            <section className="panel p-5">
              <h2 className="card-title mb-2 flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-accent-soft" />
                Prep tips
              </h2>
              <p className="text-[13.5px] leading-relaxed text-ink-300">{data.prepTips}</p>
            </section>
          ) : null}

          <section className="panel p-5">
            <h2 className="card-title mb-4 flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-accent-soft" />
              Commonly practiced for {data.name} prep
            </h2>
            {grouped.length === 0 ? (
              <p className="text-[13px] text-ink-500">No tagged problems yet.</p>
            ) : (
              <div className="space-y-5">
                {grouped.map((group) => (
                  <div key={group.difficulty}>
                    <div className="card-eyebrow mb-2">{group.difficulty.toLowerCase()}</div>
                    <div className="space-y-1.5">
                      {group.questions.map((q) => (
                        <Link
                          key={q.problemSlug}
                          href={`/problems/${q.problemSlug}/solve`}
                          className="flex items-center gap-2.5 rounded-lg border border-ink-800 bg-ink-900/50 px-3 py-2.5 text-[13px] transition-colors hover:border-ink-600 hover:bg-ink-800/60"
                        >
                          <span className="min-w-0 flex-1 truncate text-ink-200">{q.problemTitle}</span>
                          <span
                            className={cn(
                              'shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-medium uppercase',
                              DIFFICULTY_STYLES[q.difficulty],
                            )}
                          >
                            {q.difficulty[0]}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div>
          <section className="panel p-5">
            <h2 className="card-eyebrow mb-3">Focus areas</h2>
            {data.focusAreas.length ? (
              <ul className="space-y-2">
                {data.focusAreas.map((area) => (
                  <li key={area} className="flex items-center gap-2 text-[13px] text-ink-300">
                    <Check className="h-3.5 w-3.5 shrink-0 text-easy" />
                    {area.replace(/-/g, ' ')}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12.5px] text-ink-500">No focus areas listed.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
