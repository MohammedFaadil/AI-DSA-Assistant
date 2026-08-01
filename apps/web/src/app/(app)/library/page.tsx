'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Building2,
  Clock,
  Code2,
  Gauge,
  Library as LibraryIcon,
  Map as MapIcon,
  Search,
  Sparkles,
  Tag,
  Trash2,
} from 'lucide-react';
import type { LibraryEntry, SavedCompanyProfileDto, SavedCurriculumSectionDto } from '@repo/contracts';
import { api } from '@/lib/api-client';
import { DIFFICULTY_STYLES, cn, formatMs, relativeTime, verdictTone } from '@/lib/utils';
import { SectionHeading, EmptyState, TabSwitcher } from '@/components/ui/primitives';

type SortMode = 'recent' | 'quality' | 'title';
type ContentTab = 'solutions' | 'curriculum' | 'companies';

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'recent', label: 'Recent' },
  { value: 'quality', label: 'Strength' },
  { value: 'title', label: 'A–Z' },
];

const CONTENT_TABS: { value: ContentTab; label: string }[] = [
  { value: 'solutions', label: 'Solutions' },
  { value: 'curriculum', label: 'Curriculum' },
  { value: 'companies', label: 'Companies' },
];

export default function LibraryPage() {
  const queryClient = useQueryClient();
  const [contentTab, setContentTab] = useState<ContentTab>('solutions');
  const [search, setSearch] = useState('');
  const [tag, setTag] = useState<string | undefined>();
  const [sort, setSort] = useState<SortMode>('recent');
  const [selected, setSelected] = useState<string | null>(null);

  const query = useMemo(() => ({ search: search || undefined, tag, sort }), [search, tag, sort]);

  const library = useQuery({
    queryKey: ['library', query],
    queryFn: () =>
      api.get<{ items: LibraryEntry[]; tags: string[]; total: number }>('/v1/library', { query }),
  });

  const remove = useMutation({
    mutationFn: (problemId: string) => api.delete(`/v1/library/${problemId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['library'] });
      setSelected(null);
    },
  });

  const savedSections = useQuery({
    queryKey: ['library', 'sections'],
    queryFn: () => api.get<{ items: SavedCurriculumSectionDto[] }>('/v1/library/sections'),
    enabled: contentTab === 'curriculum',
  });
  const removeSection = useMutation({
    mutationFn: (sectionSlug: string) => api.delete(`/v1/library/sections/${sectionSlug}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['library', 'sections'] }),
  });

  const savedCompanies = useQuery({
    queryKey: ['library', 'companies'],
    queryFn: () => api.get<{ items: SavedCompanyProfileDto[] }>('/v1/library/companies'),
    enabled: contentTab === 'companies',
  });
  const removeCompany = useMutation({
    mutationFn: (companySlug: string) => api.delete(`/v1/library/companies/${companySlug}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['library', 'companies'] }),
  });

  const items = library.data?.items ?? [];
  const active = items.find((i) => i.problemId === selected) ?? items[0] ?? null;

  const avgQuality = items.length
    ? Math.round(
        items.filter((i) => i.qualityScore !== null).reduce((sum, i) => sum + (i.qualityScore ?? 0), 0) /
          Math.max(1, items.filter((i) => i.qualityScore !== null).length),
      )
    : null;

  return (
    <div className="page-container">
      <SectionHeading
        eyebrow="Everything you've saved"
        title="Library"
        description="Solutions, curriculum sections, and companies you chose to keep — everything links back to the live source, never a snapshot."
        action={<TabSwitcher value={contentTab} onChange={setContentTab} options={[...CONTENT_TABS]} />}
      />

      {contentTab === 'solutions' && avgQuality !== null ? (
        <div className="panel mb-5 flex w-fit items-center gap-3 px-4 py-2.5">
          <Gauge className="h-4 w-4 text-accent-soft" />
          <div>
            <div className="stat-value text-sm font-semibold text-ink-100">{avgQuality}/100</div>
            <div className="text-[10.5px] text-ink-500">avg strength</div>
          </div>
        </div>
      ) : null}

      {contentTab === 'curriculum' ? (
        <SavedSectionsView
          items={savedSections.data?.items ?? []}
          isLoading={savedSections.isLoading}
          onRemove={(slug) => removeSection.mutate(slug)}
        />
      ) : contentTab === 'companies' ? (
        <SavedCompaniesView
          items={savedCompanies.data?.items ?? []}
          isLoading={savedCompanies.isLoading}
          onRemove={(slug) => removeCompany.mutate(slug)}
        />
      ) : (
        <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your library…"
            className="input w-56 pl-9"
          />
        </div>
        <TabSwitcher value={sort} onChange={setSort} options={SORT_OPTIONS} />
        {library.data?.tags.map((t) => (
          <button
            key={t}
            onClick={() => setTag(tag === t ? undefined : t)}
            className={cn(
              'chip transition-colors',
              tag === t ? 'border-accent/50 bg-accent/12 text-accent-soft' : 'hover:border-ink-600',
            )}
          >
            <Tag className="h-2.5 w-2.5" />
            {t}
          </button>
        ))}
      </div>

      {library.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-[19rem_1fr]">
          <div className="skeleton h-96" />
          <div className="skeleton h-96" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={LibraryIcon}
          title="Nothing saved yet"
          description="Open the mentor panel while solving a problem and use the save icon to keep that solution here."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[19rem_1fr]">
          <ul className="panel max-h-[72vh] divide-y divide-ink-800/70 overflow-y-auto">
            {items.map((entry, index) => (
              <motion.li
                key={entry.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: Math.min(index * 0.02, 0.15) }}
              >
                <button
                  onClick={() => setSelected(entry.problemId)}
                  className={cn(
                    'flex w-full flex-col gap-1.5 px-4 py-3.5 text-left transition-colors',
                    active?.problemId === entry.problemId ? 'bg-accent/8' : 'hover:bg-ink-800/50',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[13.5px] font-medium text-ink-100">
                      {entry.problemTitle}
                    </span>
                    <span
                      className={cn(
                        'shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-medium uppercase',
                        DIFFICULTY_STYLES[entry.difficulty],
                      )}
                    >
                      {entry.difficulty[0]}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 text-[11.5px] text-ink-500">
                    <span className="font-mono">{entry.language}</span>
                    {entry.qualityScore !== null ? (
                      <span className="flex items-center gap-1 stat-value text-accent-soft">
                        <Gauge className="h-2.5 w-2.5" />
                        {entry.qualityScore}
                      </span>
                    ) : null}
                    <span>{relativeTime(entry.updatedAt)}</span>
                  </div>
                  {entry.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {entry.tags.slice(0, 3).map((t) => (
                        <span key={t} className="text-[10px] text-ink-600">
                          #{t}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </button>
              </motion.li>
            ))}
          </ul>

          {active ? (
            <div className="panel overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-700/70 px-5 py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="card-title">{active.problemTitle}</h2>
                    <span className={cn('chip border', DIFFICULTY_STYLES[active.difficulty])}>
                      {active.difficulty.toLowerCase()}
                    </span>
                    {active.isGenerated ? (
                      <span className="chip badge-tone-accent border">
                        <Sparkles className="h-2.5 w-2.5" />
                        Practice Zone
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {active.topics.map((t) => (
                      <span key={t} className="chip text-[10px]">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/problems/${active.problemSlug}/solve`} className="btn-outline !py-1.5 text-xs">
                    <Code2 className="h-3.5 w-3.5" />
                    Open in workspace
                  </Link>
                  <button
                    onClick={() => remove.mutate(active.problemId)}
                    className="btn-ghost !py-1.5 text-xs text-hard hover:bg-hard/10"
                    aria-label="Remove from library"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-b border-ink-700/70 px-5 py-4 text-xs sm:grid-cols-4">
                <Metric
                  label="Verdict"
                  value={active.verdict ? active.verdict.replace(/_/g, ' ').toLowerCase() : '—'}
                  tone={active.verdict ? verdictTone(active.verdict) : undefined}
                />
                <Metric icon={Clock} label="Runtime" value={formatMs(active.runtimeMs)} />
                <Metric icon={Gauge} label="Strength" value={active.qualityScore !== null ? `${active.qualityScore}/100` : '—'} />
                <Metric label="Complexity" value={active.complexity ?? '—'} />
              </div>

              {active.note ? (
                <div className="border-b border-ink-700/70 bg-ink-900/30 px-5 py-3.5 text-[13px] leading-relaxed text-ink-300">
                  {active.note}
                </div>
              ) : null}

              <pre className="max-h-[26rem] overflow-auto bg-ink-950 p-5 font-mono text-[12.5px] leading-relaxed text-ink-200">
                <code>{active.code}</code>
              </pre>
            </div>
          ) : null}
        </div>
      )}
        </>
      )}
    </div>
  );
}

function SavedSectionsView({
  items,
  isLoading,
  onRemove,
}: {
  items: SavedCurriculumSectionDto[];
  isLoading: boolean;
  onRemove: (sectionSlug: string) => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton h-16" />
        ))}
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <EmptyState
        icon={MapIcon}
        title="No saved sections yet"
        description="Open a concept in the Curriculum and use the bookmark button to keep it here."
      />
    );
  }
  return (
    <ul className="space-y-2">
      {items.map((entry) => (
        <motion.li
          key={entry.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="panel-interactive flex items-center gap-3 p-4"
        >
          <Link href={`/curriculum?section=${entry.sectionSlug}`} className="flex min-w-0 flex-1 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-accent/30 bg-accent/10 text-accent-soft">
              <MapIcon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-medium text-ink-100">{entry.sectionTitle}</span>
              <span className="block text-[11.5px] text-ink-500">
                {entry.track === 'FOUNDATIONS' ? 'Foundations' : 'Advanced'} &middot; saved {relativeTime(entry.createdAt)}
              </span>
            </span>
          </Link>
          <button
            onClick={() => onRemove(entry.sectionSlug)}
            className="shrink-0 rounded-md p-2 text-ink-500 transition-colors hover:bg-hard/10 hover:text-hard"
            aria-label="Remove"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </motion.li>
      ))}
    </ul>
  );
}

function SavedCompaniesView({
  items,
  isLoading,
  onRemove,
}: {
  items: SavedCompanyProfileDto[];
  isLoading: boolean;
  onRemove: (companySlug: string) => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton h-16" />
        ))}
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Building2}
        title="No saved companies yet"
        description="Open a company's prep page and use the save button to keep it here."
      />
    );
  }
  return (
    <ul className="space-y-2">
      {items.map((entry) => (
        <motion.li
          key={entry.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="panel-interactive flex items-center gap-3 p-4"
        >
          <Link href={`/companies/${entry.companySlug}`} className="flex min-w-0 flex-1 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-accent/30 bg-accent/10 text-accent-soft">
              <Building2 className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-medium text-ink-100">{entry.companyName}</span>
              <span className="block text-[11.5px] text-ink-500">saved {relativeTime(entry.createdAt)}</span>
            </span>
          </Link>
          <button
            onClick={() => onRemove(entry.companySlug)}
            className="shrink-0 rounded-md p-2 text-ink-500 transition-colors hover:bg-hard/10 hover:text-hard"
            aria-label="Remove"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </motion.li>
      ))}
    </ul>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-ink-500">
        {Icon ? <Icon className="h-2.5 w-2.5" /> : null}
        {label}
      </div>
      <div className={cn('mt-1 truncate font-medium capitalize', tone ?? 'text-ink-200')}>{value}</div>
    </div>
  );
}
