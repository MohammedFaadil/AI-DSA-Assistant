'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ApiClientError } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';

export function Providers({ children }: { children: React.ReactNode }) {
  const bootstrap = useAuthStore((s) => s.bootstrap);

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            refetchOnWindowFocus: false,
            retry: (failureCount, error) => {
              // Authorization and validation failures are terminal — retrying
              // them just delays the message the user needs to see.
              if (error instanceof ApiClientError) {
                if ([400, 401, 403, 404, 409, 422].includes(error.status)) return false;
                // A cold AI container is expected on free tier, so it gets a
                // longer, more patient retry budget than a real failure.
                if (error.isWarming) return failureCount < 6;
              }
              return failureCount < 2;
            },
            retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
          },
          mutations: { retry: 0 },
        },
      }),
  );

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
