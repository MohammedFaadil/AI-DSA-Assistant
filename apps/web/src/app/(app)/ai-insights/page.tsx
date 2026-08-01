'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * AI Performance was merged into the Progress page as a tab. This route is
 * kept as a redirect so old links/bookmarks still resolve.
 */
export default function AiInsightsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/progress?tab=ai-performance');
  }, [router]);

  return null;
}
