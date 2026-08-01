'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  Check,
  ChevronDown,
  Circle,
  Clock,
  GraduationCap,
  Lock,
  Sparkles,
} from 'lucide-react';
import * as Icons from 'lucide-react';
import type { CurriculumSectionDto, CurriculumTrack, SavedCurriculumSectionDto } from '@repo/contracts';
import { api } from '@/lib/api-client';
import { DIFFICULTY_STYLES, cn, renderMarkdown } from '@/lib/utils';
import { SectionHeading, MiniGauge, ProgressRing, TabSwitcher } from '@/components/ui/primitives';
import { LessonBlocks } from '@/components/curriculum/LessonBlocks';
import { CurriculumTutorPanel } from '@/features/curriculum/CurriculumTutorPanel';

/** Icons are stored as plain names in the seed data; resolved via an explicit
 * map (not `import * as Icons`) so unused icons still get tree-shaken. */
const CONCEPT_ICONS: Record<string, Icons.LucideIcon> = {
  Rows3: Icons.Rows3,
  KeyRound: Icons.KeyRound,
  MoveHorizontal: Icons.MoveHorizontal,
  Layers: Icons.Layers,
  Crosshair: Icons.Crosshair,
  Network: Icons.Network,
  Share2: Icons.Share2,
  Flame: Icons.Flame,
  ArrowUpDown: Icons.ArrowUpDown,
  GitBranch: Icons.GitBranch,
  GitFork: Icons.GitFork,
  Binary: Icons.Binary,
  ListTree: Icons.ListTree,
  Waypoints: Icons.Waypoints,
  LayoutGrid: Icons.LayoutGrid,
  Grid3x3: Icons.Grid3x3,
  Gauge: Icons.Gauge,
};

function conceptIcon(name: string | null): Icons.LucideIcon {
  return (name && CONCEPT_ICONS[name]) || Icons.BookOpen;
}

const TRACK_OPTIONS: { value: CurriculumTrack; label: string }[] = [
  { value: 'FOUNDATIONS', label: 'Foundations' },
  { value: 'ADVANCED', label: 'Advanced' },
];

export default function CurriculumPage() {
  const searchParams = useSearchParams();
  const requestedSlug = searchParams.get('section');
  const queryClient = useQueryClient();

  const [track, setTrack] = useState<CurriculumTrack>('FOUNDATIONS');
  const [openSlug, setOpenSlug] = useState<string | null>(requestedSlug);
  const [tutorSection, setTutorSection] = useState<{
    slug: string;
    title: string;
  } | null>(null);

  const curriculum = useQuery({
    queryKey: ['curriculum'],
    queryFn: () => api.get<{ sections: CurriculumSectionDto[] }>('/v1/curriculum'),
  });

  const savedSections = useQuery({
    queryKey: ['library', 'sections'],
    queryFn: () => api.get<{ items: SavedCurriculumSectionDto[] }>('/v1/library/sections'),
    staleTime: 60_000,
  });
  const savedSlugs = new Set((savedSections.data?.items ?? []).map((s) => s.sectionSlug));

  const toggleSaveSection = useMutation({
    mutationFn: (slug: string) =>
      savedSlugs.has(slug)
        ? api.delete(`/v1/library/sections/${slug}`)
        : api.post(`/v1/library/sections/${slug}`, {}),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['library', 'sections'] }),
  });

  const allSections = curriculum.data?.sections ?? [];

  // Reciprocal link from the Problems page ("View curriculum lesson") — jump
  // to the right track and scroll the requested section into view.
  useEffect(() => {
    if (!requestedSlug) return;
    const target = allSections.find((s) => s.slug === requestedSlug);
    if (!target) return;
    setTrack(target.track);
    setOpenSlug(target.slug);
    const el = document.getElementById(`section-${target.slug}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Only needs to run once the data carrying this slug's track has arrived.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedSlug, allSections.length]);

  const sections = useMemo(
    () => allSections.filter((s) => s.track === track).sort((a, b) => a.order - b.order),
    [allSections, track],
  );

  const overallByTrack = useMemo(() => {
    const forTrack = (t: CurriculumTrack) => allSections.filter((s) => s.track === t);
    const mean = (rows: CurriculumSectionDto[]) =>
      rows.length ? rows.reduce((sum, s) => sum + s.completion, 0) / rows.length : 0;
    return {
      FOUNDATIONS: mean(forTrack('FOUNDATIONS')),
      ADVANCED: mean(forTrack('ADVANCED')),
    };
  }, [allSections]);

  // The first not-fully-unlocked-and-incomplete section is where a learner
  // should pick back up — expand it by default rather than making them hunt.
  const defaultOpenSlug = useMemo(() => {
    const inProgress = sections.find((s) => s.unlocked && s.completion < 1);
    return inProgress?.slug ?? sections[0]?.slug ?? null;
  }, [sections]);

  const effectiveOpen = openSlug ?? defaultOpenSlug;

  return (
    <div className="page-container">
      <SectionHeading
        eyebrow="Concept by concept"
        title="Curriculum"
        description="Every section teaches one idea first — what it is, when to reach for it, where it goes wrong — then attaches problems to practise it. Two tracks cover the same catalogue at different depths."
        action={
          <TabSwitcher
            value={track}
            onChange={(value) => {
              setTrack(value);
              setOpenSlug(null);
            }}
            options={TRACK_OPTIONS.map((option) => ({
              ...option,
              count: allSections.filter((s) => s.track === option.value).length,
            }))}
          />
        }
      />

      {allSections.length > 0 ? (
        <div className="panel mb-6 flex items-center gap-5 p-5">
          <ProgressRing value={overallByTrack[track]} size={64}>
            <span className="stat-value text-sm font-semibold text-ink-100">
              {Math.round(overallByTrack[track] * 100)}%
            </span>
          </ProgressRing>
          <div>
            <div className="text-sm font-medium text-ink-100">
              {track === 'FOUNDATIONS' ? 'Foundations' : 'Advanced'} track progress
            </div>
            <p className="mt-1 text-[13px] text-ink-400">
              {track === 'FOUNDATIONS'
                ? 'A beginner-first sequence: arrays and hashing before graphs, on purpose.'
                : 'Interview-depth patterns: heaps, backtracking, bit tricks, greedy proofs, and DP shapes.'}
            </p>
          </div>
        </div>
      ) : null}

      {curriculum.isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-24" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {sections.map((section, index) => (
            <ConceptCard
              key={section.slug}
              section={section}
              index={index}
              isOpen={effectiveOpen === section.slug}
              onToggle={() =>
                setOpenSlug((current) => (current === section.slug ? '' : section.slug))
              }
              onTrainWithAi={() => setTutorSection({ slug: section.slug, title: section.title })}
              isSaved={savedSlugs.has(section.slug)}
              onToggleSave={() => toggleSaveSection.mutate(section.slug)}
            />
          ))}
        </div>
      )}

      {tutorSection ? (
        <CurriculumTutorPanel
          sectionSlug={tutorSection.slug}
          sectionTitle={tutorSection.title}
          open={tutorSection !== null}
          onClose={() => setTutorSection(null)}
        />
      ) : null}
    </div>
  );
}

function ConceptCard({
  section,
  index,
  isOpen,
  onToggle,
  onTrainWithAi,
  isSaved,
  onToggleSave,
}: {
  section: CurriculumSectionDto;
  index: number;
  isOpen: boolean;
  onToggle: () => void;
  onTrainWithAi: () => void;
  isSaved: boolean;
  onToggleSave: () => void;
}) {
  const Icon = conceptIcon(section.icon);
  const complete = section.completion >= 0.999;

  return (
    <motion.div
      id={`section-${section.slug}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.3), duration: 0.3 }}
      className={cn('panel overflow-hidden', !section.unlocked && 'opacity-70')}
    >
      <div className={cn('flex items-center gap-2', section.unlocked && 'hover:bg-ink-800/30')}>
        <button
          onClick={section.unlocked ? onToggle : undefined}
          disabled={!section.unlocked}
          className="flex w-full min-w-0 flex-1 items-center gap-4 p-5 text-left transition-colors"
        >
          <div
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border',
              complete
                ? 'border-easy/30 bg-easy/10 text-easy'
                : section.unlocked
                  ? 'border-accent/30 bg-accent/10 text-accent-soft'
                  : 'border-ink-700 bg-ink-900 text-ink-600',
            )}
          >
            {complete ? (
              <Check className="h-5 w-5" />
            ) : section.unlocked ? (
              <Icon className="h-5 w-5" />
            ) : (
              <Lock className="h-4 w-4" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="card-title">{section.title}</span>
              {!section.unlocked ? (
                <span className="chip border-ink-700 text-ink-500">
                  <Lock className="h-2.5 w-2.5" />
                  Complete the previous concept first
                </span>
              ) : null}
            </div>
            <p className="card-meta mt-1 line-clamp-1">{section.description}</p>
          </div>

          <div className="hidden w-36 shrink-0 sm:block">
            <MiniGauge value={section.completion} />
            <div className="mt-1.5 flex justify-between text-[11px] text-ink-500">
              <span>
                {section.coreSolved}/{section.coreTotal} core
              </span>
              <span>{Math.round(section.mastery * 100)}% mastery</span>
            </div>
          </div>

          {section.unlocked ? (
            <ChevronDown
              className={cn(
                'h-4 w-4 shrink-0 text-ink-500 transition-transform',
                isOpen && 'rotate-180',
              )}
            />
          ) : (
            <div className="w-4 shrink-0" />
          )}
        </button>

        {section.unlocked ? (
          <>
            <button
              onClick={onToggleSave}
              className={cn('btn-ghost shrink-0 !p-2', isSaved && 'text-accent-soft')}
              title={isSaved ? 'Remove from Library' : 'Save to Library'}
              aria-label={isSaved ? 'Remove from Library' : 'Save to Library'}
            >
              {isSaved ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={onTrainWithAi}
              className="btn-outline mr-4 shrink-0 !py-1.5 text-[12px]"
              title="Open the AI tutor for this section"
            >
              <GraduationCap className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Train with AI</span>
            </button>
          </>
        ) : null}
      </div>

      <AnimatePresence initial={false}>
        {isOpen && section.unlocked ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-hidden border-t border-ink-800"
          >
            <div className="grid gap-6 p-6 lg:grid-cols-[1fr_20rem]">
              {/* The lesson — primary content */}
              <div>
                <div
                  className="prose-mentor text-[13.5px]"
                  dangerouslySetInnerHTML={{
                    __html: renderMarkdown(section.lesson),
                  }}
                />

                {section.keyPatterns.length > 0 ? (
                  <div className="mt-5">
                    <div className="card-eyebrow mb-2.5">Recognise it by</div>
                    <ul className="space-y-2">
                      {section.keyPatterns.map((pattern, i) => (
                        <li key={i} className="flex items-start gap-2 text-[13px] text-ink-300">
                          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-soft" />
                          {pattern}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {section.commonPitfall ? (
                  <div className="mt-5 flex items-start gap-2.5 rounded-lg border border-medium/25 bg-medium/5 p-3.5">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-medium" />
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-medium">
                        Common pitfall
                      </div>
                      <p className="mt-1 text-[13px] leading-relaxed text-ink-300">
                        {section.commonPitfall}
                      </p>
                    </div>
                  </div>
                ) : null}

                <div className="mt-5 flex flex-wrap gap-2">
                  {section.outcome ? (
                    <span className="chip badge-tone-accent border">
                      <Sparkles className="h-2.5 w-2.5" />
                      Outcome: {section.outcome}
                    </span>
                  ) : null}
                  {section.typicalTime ? (
                    <span className="chip border">
                      <Clock className="h-2.5 w-2.5" />
                      {section.typicalTime} time
                    </span>
                  ) : null}
                  {section.typicalSpace ? (
                    <span className="chip border">{section.typicalSpace} space</span>
                  ) : null}
                </div>

                <LessonBlocks blocks={section.blocks} />
              </div>

              {/* Practice problems — secondary, attached to the concept */}
              <div>
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <div className="card-eyebrow">Practice this concept</div>
                  <Link
                    href={`/problems?section=${section.slug}`}
                    className="text-[11px] font-medium text-accent-soft hover:text-accent"
                  >
                    All {section.problemCount} problems &rarr;
                  </Link>
                </div>
                <div className="space-y-1.5">
                  {section.problems.map((problem) => (
                    <Link
                      key={problem.problemId}
                      href={`/problems/${problem.slug}/solve`}
                      className="flex items-center gap-2.5 rounded-lg border border-ink-800 bg-ink-900/50 px-3 py-2.5 text-[13px] transition-colors hover:border-ink-600 hover:bg-ink-800/60"
                    >
                      {problem.status === 'SOLVED' ? (
                        <Check className="h-3.5 w-3.5 shrink-0 text-easy" />
                      ) : problem.status === 'ATTEMPTED' ? (
                        <Circle className="h-3 w-3 shrink-0 fill-medium text-medium" />
                      ) : (
                        <Circle className="h-3 w-3 shrink-0 text-ink-600" />
                      )}
                      <span
                        className={cn(
                          'min-w-0 flex-1 truncate',
                          problem.status === 'SOLVED' ? 'text-easy' : 'text-ink-200',
                        )}
                      >
                        {problem.title}
                      </span>
                      {!problem.isCore ? (
                        <span className="shrink-0 text-[10px] uppercase tracking-wide text-ink-600">
                          extra
                        </span>
                      ) : null}
                      <span
                        className={cn(
                          'shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-medium uppercase',
                          DIFFICULTY_STYLES[problem.difficulty],
                        )}
                      >
                        {problem.difficulty[0]}
                      </span>
                    </Link>
                  ))}
                </div>

                {section.nextUp ? (
                  <Link
                    href={`/problems/${section.nextUp.slug}/solve`}
                    className="btn-primary mt-4 w-full !py-2 text-[13px]"
                  >
                    Continue with {section.nextUp.title}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                ) : (
                  <div className="mt-4 rounded-lg border border-easy/25 bg-easy/8 px-3 py-2.5 text-center text-[12.5px] text-easy">
                    Every core problem here is solved.
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}
