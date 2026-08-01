'use client';

import { create } from 'zustand';
import type { AuthResponse, SessionUser } from '@repo/contracts';
import { api, setAccessToken } from '@/lib/api-client';
import { disconnectSocket } from '@/lib/socket';

interface AuthState {
  user: SessionUser | null;
  status: 'idle' | 'loading' | 'authenticated' | 'anonymous';
  error: string | null;

  bootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    email: string;
    username: string;
    password: string;
    name?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  patchUser: (partial: Partial<SessionUser>) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'idle',
  error: null,

  /**
   * Runs once on mount. There is no access token in memory after a page load,
   * so we exchange the httpOnly refresh cookie for one. A failure here is the
   * normal anonymous case, not an error worth showing.
   */
  bootstrap: async () => {
    set({ status: 'loading' });
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/v1/auth/refresh`,
        { method: 'POST', credentials: 'include' },
      );
      if (!response.ok) {
        set({ status: 'anonymous', user: null });
        return;
      }
      const body = (await response.json()) as AuthResponse;
      setAccessToken(body.accessToken);
      set({ user: body.user, status: 'authenticated', error: null });
    } catch {
      set({ status: 'anonymous', user: null });
    }
  },

  login: async (email, password) => {
    set({ error: null });
    const body = await api.post<AuthResponse>('/v1/auth/login', { email, password });
    setAccessToken(body.accessToken);
    set({ user: body.user, status: 'authenticated' });
  },

  register: async (input) => {
    set({ error: null });
    const body = await api.post<AuthResponse>('/v1/auth/register', input);
    setAccessToken(body.accessToken);
    set({ user: body.user, status: 'authenticated' });
  },

  logout: async () => {
    await api.post('/v1/auth/logout').catch(() => undefined);
    setAccessToken(null);
    disconnectSocket();
    set({ user: null, status: 'anonymous' });
  },

  patchUser: (partial) =>
    set((state) => ({ user: state.user ? { ...state.user, ...partial } : state.user })),
}));
