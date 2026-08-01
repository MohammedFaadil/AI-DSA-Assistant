'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Building2,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Search,
  SlidersHorizontal,
  Tag,
  X,
} from 'lucide-react';
import type { OffsetPage, ProblemsGrouped, ProblemSummary } from '@repo/contracts';
import { api } from '@/lib/api-client';
import { DIFFICULTY_STYLES, cn } from '@/lib/utils';
import { SectionHeading, EmptyState, TabSwitcher } from '@/components/ui/primitives';

const VIEW_OPTIONS = [
  { value: 'section', label: 'By section' },
  { value: 'all', label: 'All problems' },
] as const;
type ViewMode = (typeof VIEW_OPTIONS)[number]['value'];

interface Facets {
  topics: { slug: string; name: string; count: number }[];
  companies: { slug: string; name: string; count: number }[];
}

const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'] as const;
const STATUSES = [
  { value: 'TODO', label: 'To do' },
  { value: 'ATTEMPTED', label: 'Attempted' },
  { value: 'SOLVED', label: 'Solved' },
] as const;

export default function ProblemsPage() {
  const searchParams = useSearchParams();
  const initialView: ViewMode = searchParams.get('view') === 'all' ? 'all' : 'section';
  const [view, setView] = useState<ViewMode>(initialView);
  const [openSection, setOpenSection] = useState<string | null>(searchParams.get('section'));

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [difficulty, setDifficulty] = useState<string[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [status, setStatus] = useState<string | undefined>();
  const [showFilters, setShowFilters] = useState(false);
  const [companyPanelOpen, setCompanyPanelOpen] = useState(false);

  const facets = useQuery({
    queryKey: ['problems', 'facets'],
    queryFn: () => api.get<Facets>('/v1/problems/meta/facets'),
    staleTime: 30 * 60_000,
  });

  const grouped = useQuery({
    queryKey: ['problems', 'grouped'],
    queryFn: () => api.get<ProblemsGrouped>('/v1/problems/grouped'),
    enabled: view === 'section',
  });

  const query = useMemo(
    () => ({ page, pageSize: 50, search, difficulty, topics, companies, status }),
    [page, search, difficulty, topics, companies, status],
  );

  const problems = useQuery({
    queryKey: ['problems', 'list', query],
    queryFn: () => api.get<OffsetPage<ProblemSummary>>('/v1/problems', { query }),
    placeholderData: keepPreviousData,
  });

  const toggle = (value: string, list: string[], setter: (next: string[]) => void): void => {
    setPage(1);
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  const activeFilterCount = difficulty.length + topics.length + companies.length + (status ? 1 : 0);
  const topCompanies = (facets.data?.companies ?? []).slice(0, 8);

  return (
    <div className="page-container">
      <SectionHeading
        eyebrow={problems.data ? `${problems.data.total} problems` : undefined}
        title="Problems"
        description="Every problem here ships with derived-and-verified test cases — expected outputs are computed by executing the reference solution, never hand-typed."
        action={<TabSwitcher value={view} onChange={setView} options={[...VIEW_OPTIONS]} />}
      />

      {/* Search + quick company row */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search problems…"
            className="input pl-9"
          />
        </div>
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={cn('btn-outline', activeFilterCount > 0 && 'border-accent/50 text-accent-soft')}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {activeFilterCount > 0 ? (
            <span className="rounded-full bg-accent px-1.5 text-[10px] font-semibold text-white">
              {activeFilterCount}
            </span>
          ) : null}
        </button>

        {/* Company quick-picks — the fast entry point; /companies is the full prep area */}
        <div className="flex flex-1 flex-wrap items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5 shrink-0 text-ink-500" />
          {topCompanies.map((company) => (
            <button
              key={company.slug}
              onClick={() => toggle(company.slug, companies, setCompanies)}
              className={cn(
                'chip-lg transition-colors',
                companies.includes(company.slug)
                  ? 'border-accent/50 bg-accent/12 text-accent-soft'
                  : 'hover:border-ink-600 hover:text-ink-100',
              )}
            >
              {company.name}
              <span className="text-ink-500">{company.count}</span>
            </button>
          ))}
          {(facets.data?.companies.length ?? 0) > 8 ? (
            <button
              onClick={() => setCompanyPanelOpen(true)}
              className="chip-lg text-accent-soft hover:border-accent/40"
            >
              +{(facets.data?.companies.length ?? 0) - 8} more
            </button>
          ) : null}
          <Link href="/companies" className="chip-lg text-accent-soft hover:border-accent/40">
            Full company prep &rarr;
          </Link>
        </div>
      </div>

      {view === 'section' ? (
        <GroupedView
          data={grouped.data}
          isLoading={grouped.isLoading}
          openSection={openSection}
          setOpenSection={setOpenSection}
        />
      ) : (
        <>
          {showFilters ? (
            <div className="panel mb-5 animate-fade-up space-y-5 p-5">
              <FilterGroup label="Difficulty">
                {DIFFICULTIES.map((value) => (
                  <FilterPill
                    key={value}
                    active={difficulty.includes(value)}
                    onClick={() => toggle(value, difficulty, setDifficulty)}
                    className={difficulty.includes(value) ? DIFFICULTY_STYLES[value] : undefined}
                  >
                    {value.toLowerCase()}
                  </FilterPill>
                ))}
              </FilterGroup>

              <FilterGroup label="Status">
                {STATUSES.map((item) => (
                  <FilterPill
                    key={item.value}
                    active={status === item.value}
                    onClick={() => {
                      setPage(1);
                      setStatus(status === item.value ? undefined : item.value);
                    }}
                  >
                    {item.label}
                  </FilterPill>
                ))}
              </FilterGroup>

              <FilterGroup label="Topics — all selected must match">
                {facets.data?.topics.map((topic) => (
                  <FilterPill
                    key={topic.slug}
                    active={topics.includes(topic.slug)}
                    onClick={() => toggle(topic.slug, topics, setTopics)}
                  >
                    {topic.name}
                    <span className="text-[10px] text-ink-500">{topic.count}</span>
                  </FilterPill>
                ))}
              </FilterGroup>

              <FilterGroup label="Companies — any selected may match">
                {facets.data?.companies.map((company) => (
                  <FilterPill
                    key={company.slug}
                    active={companies.includes(company.slug)}
                    onClick={() => toggle(company.slug, companies, setCompanies)}
                  >
                    {company.name}
                    <span className="text-[10px] text-ink-500">{company.count}</span>
                  </FilterPill>
                ))}
              </FilterGroup>

              {activeFilterCount > 0 ? (
                <button
                  onClick={() => {
                    setDifficulty([]);
                    setTopics([]);
                    setCompanies([]);
                    setStatus(undefined);
                    setPage(1);
                  }}
                  className="flex items-center gap-1 text-xs text-ink-400 underline-offset-4 hover:text-ink-200 hover:underline"
                >
                  <X className="h-3 w-3" />
                  Clear all filters
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="panel overflow-hidden">
            <div className="grid grid-cols-[2.25rem_1fr_auto] gap-4 border-b border-ink-700/70 px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-ink-500 sm:grid-cols-[2.25rem_1fr_7rem_6rem]">
              <span />
              <span>Title</span>
              <span className="hidden sm:block">Acceptance</span>
              <span className="text-right">Difficulty</span>
            </div>

            {problems.isLoading ? (
              <div className="space-y-2.5 p-5">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="skeleton h-11" />
                ))}
              </div>
            ) : problems.data?.items.length ? (
              <ul className="divide-y divide-ink-800/70">
                {problems.data.items.map((problem) => (
                  <li key={problem.id}>
                    <Link
                      href={`/problems/${problem.slug}/solve`}
                      className="grid grid-cols-[2.25rem_1fr_auto] items-center gap-4 px-5 py-3.5 transition-colors hover:bg-ink-800/50 sm:grid-cols-[2.25rem_1fr_7rem_6rem]"
                    >
                      <span className="flex items-center">
                        {problem.userStatus === 'SOLVED' ? (
                          <span title="Solved">
                            <Check className="h-4 w-4 text-easy" aria-label="Solved" />
                          </span>
                        ) : problem.userStatus === 'ATTEMPTED' ? (
                          <span title="Attempted, not yet solved">
                            <CircleDot className="h-4 w-4 text-medium" aria-label="Attempted" />
                          </span>
                        ) : (
                          <span className="block h-4 w-4" />
                        )}
                      </span>

                      <span className="min-w-0">
                        <span className="block truncate text-[13.5px] font-medium text-ink-100">
                          {problem.title}
                        </span>
                        <span className="mt-1 flex flex-wrap gap-1">
                          {problem.topics.slice(0, 3).map((topic) => (
                            <span key={topic.slug} className="chip text-[10px]">
                              {topic.name}
                            </span>
                          ))}
                        </span>
                      </span>

                      <span className="hidden text-[13px] tabular-nums text-ink-400 sm:block">
                        {problem.acceptanceRate}%
                      </span>

                      <span
                        className={cn(
                          'justify-self-end rounded border px-2 py-0.5 text-[11px] font-medium uppercase',
                          DIFFICULTY_STYLES[problem.difficulty],
                        )}
                      >
                        {problem.difficulty}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={Search}
                title="No problems match"
                description="Try clearing a filter or searching a different term."
              />
            )}
          </div>

          {problems.data && problems.data.totalPages > 1 ? (
            <div className="mt-5 flex items-center justify-center gap-2">
              <button
                className="btn-outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>
              <span className="px-3 text-sm tabular-nums text-ink-400">
                {page} / {problems.data.totalPages}
              </span>
              <button
                className="btn-outline"
                disabled={page >= problems.data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </>
      )}

      {companyPanelOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
          onClick={() => setCompanyPanelOpen(false)}
        >
          <div
            className="panel max-h-[70vh] w-full max-w-lg overflow-y-auto p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Tag className="h-4 w-4 text-accent-soft" />
                All companies
              </h3>
              <button onClick={() => setCompanyPanelOpen(false)} className="rounded p-1 hover:bg-ink-800">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {facets.data?.companies.map((company) => (
                <FilterPill
                  key={company.slug}
                  active={companies.includes(company.slug)}
                  onClick={() => toggle(company.slug, companies, setCompanies)}
                >
                  {company.name}
                  <span className="text-[10px] text-ink-500">{company.count}</span>
                </FilterPill>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function GroupedView({
  data,
  isLoading,
  openSection,
  setOpenSection,
}: {
  data: ProblemsGrouped | undefined;
  isLoading: boolean;
  openSection: string | null;
  setOpenSection: (slug: string | null) => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton h-16" />
        ))}
      </div>
    );
  }

  const sections = data?.sections ?? [];
  const unassigned = data?.unassigned ?? [];

  return (
    <div className="space-y-3">
      {sections.map((section, index) => {
        const isOpen = openSection === section.sectionSlug;
        return (
          <motion.div
            key={section.sectionSlug}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(index * 0.03, 0.25) }}
            className="panel overflow-hidden"
          >
            <button
              onClick={() => setOpenSection(isOpen ? null : section.sectionSlug)}
              className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-ink-800/30"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="card-title">{section.sectionTitle}</span>
                  <span className="chip text-[10px]">{section.track === 'FOUNDATIONS' ? 'Foundations' : 'Advanced'}</span>
                </div>
                <p className="mt-0.5 text-[12px] text-ink-500">{section.problems.length} problems</p>
              </div>
              <Link
                href={`/curriculum?section=${section.sectionSlug}`}
                onClick={(e) => e.stopPropagation()}
                className="shrink-0 text-[11.5px] font-medium text-accent-soft hover:text-accent"
              >
                View curriculum lesson &rarr;
              </Link>
              <ChevronDown className={cn('h-4 w-4 shrink-0 text-ink-500 transition-transform', isOpen && 'rotate-180')} />
            </button>

            <AnimatePresence initial={false}>
              {isOpen ? (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22 }}
                  className="overflow-hidden border-t border-ink-800"
                >
                  <ul className="divide-y divide-ink-800/70">
                    {section.problems.map((problem) => (
                      <li key={problem.id}>
                        <Link
                          href={`/problems/${problem.slug}/solve`}
                          className="flex items-center gap-3 px-4 py-3 text-[13px] transition-colors hover:bg-ink-800/50"
                        >
                          {problem.userStatus === 'SOLVED' ? (
                            <Check className="h-3.5 w-3.5 shrink-0 text-easy" />
                          ) : problem.userStatus === 'ATTEMPTED' ? (
                            <CircleDot className="h-3.5 w-3.5 shrink-0 text-medium" />
                          ) : (
                            <span className="block h-3.5 w-3.5 shrink-0" />
                          )}
                          <span className="min-w-0 flex-1 truncate text-ink-200">{problem.title}</span>
                          <span
                            className={cn(
                              'shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase',
                              DIFFICULTY_STYLES[problem.difficulty],
                            )}
                          >
                            {problem.difficulty}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.div>
        );
      })}

      {unassigned.length > 0 ? (
        <div className="panel p-4">
          <div className="card-eyebrow mb-2.5">Not yet in a curriculum section</div>
          <ul className="divide-y divide-ink-800/70">
            {unassigned.map((problem) => (
              <li key={problem.id}>
                <Link
                  href={`/problems/${problem.slug}/solve`}
                  className="flex items-center gap-3 px-1 py-3 text-[13px] transition-colors hover:bg-ink-800/40"
                >
                  <span className="min-w-0 flex-1 truncate text-ink-200">{problem.title}</span>
                  <span
                    className={cn(
                      'shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase',
                      DIFFICULTY_STYLES[problem.difficulty],
                    )}
                  >
                    {problem.difficulty}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="card-eyebrow mb-2.5">{label}</div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  className,
  children,
}: {
  active: boolean;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-full border px-2.5 py-1 text-[12px] transition-colors',
        active
          ? 'border-accent/50 bg-accent/12 text-accent-soft'
          : 'border-ink-700 bg-ink-800/60 text-ink-300 hover:border-ink-600 hover:text-ink-100',
        className,
      )}
    >
      {children}
    </button>
  );
}
