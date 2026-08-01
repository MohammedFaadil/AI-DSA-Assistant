import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  TeachConversationDto,
  TeachTurnResponse,
  TeachHandoffResponse,
} from '@repo/contracts';
import { api } from '@/lib/api-client';

/**
 * AI Training — plain request/response, not Socket.IO. Unlike the
 * problem-solving workspace, there is no live code buffer or 2-second
 * analysis tick to stream here; a curriculum tutor turn is a stateless
 * ask-and-get-one-full-answer loop, so the workspace's session/socket
 * machinery would be pure overhead.
 */
export function useCurriculumTutor(sectionSlug: string) {
  const queryClient = useQueryClient();

  const conversation = useQuery({
    queryKey: ['curriculum-tutor', sectionSlug],
    queryFn: () => api.get<TeachConversationDto>(`/v1/curriculum/${sectionSlug}/conversation`),
    enabled: Boolean(sectionSlug),
  });

  const send = useMutation({
    mutationFn: (content: string) =>
      api.post<TeachTurnResponse>(`/v1/curriculum/${sectionSlug}/chat`, {
        content,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['curriculum-tutor', sectionSlug],
      });
    },
  });

  const handoff = useMutation({
    mutationFn: () => api.post<TeachHandoffResponse>(`/v1/curriculum/${sectionSlug}/handoff`, {}),
  });

  return { conversation, send, handoff };
}
