'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Building2, ChevronRight, FileCheck2 } from 'lucide-react';
import type { CompanyListItem } from '@repo/contracts';
import { api } from '@/lib/api-client';
import { SectionHeading, EmptyState } from '@/components/ui/primitives';

export default function CompaniesPage() {
  const companies = useQuery({
    queryKey: ['companies'],
    queryFn: () => api.get<{ items: CompanyListItem[] }>('/v1/companies'),
  });

  const items = companies.data?.items ?? [];

  return (
    <div className="page-container">
      <SectionHeading
        eyebrow={items.length ? `${items.length} companies` : undefined}
        title="Company Prep"
        description="General, honestly-framed interview guidance per company, plus a curated question set drawn from this platform's own company tags — never presented as verified insider information."
      />

      {companies.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-28" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={Building2} title="No companies yet" description="Check back soon." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((company, index) => (
            <motion.div
              key={company.slug}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.03, 0.25) }}
            >
              <Link href={`/companies/${company.slug}`} className="panel-interactive flex items-center gap-3 p-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-accent/30 bg-accent/10 text-accent-soft">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="card-title truncate">{company.name}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-ink-500">
                    <span>{company.problemCount} tagged problems</span>
                    {company.hasProfile ? (
                      <span className="flex items-center gap-1 text-easy">
                        <FileCheck2 className="h-2.5 w-2.5" />
                        Prep guide
                      </span>
                    ) : null}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-ink-600" />
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
