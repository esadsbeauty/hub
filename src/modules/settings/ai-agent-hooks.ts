import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  aiAgentRepository,
  type AiAgentConfigUpdate,
} from "./ai-agent-repository";

export const aiAgentKeys = {
  all: ["settings", "ai-agent"] as const,
  detail: (organizationId: string) =>
    ["settings", "ai-agent", organizationId] as const,
};

export function useAiAgent(organizationId: string) {
  return useQuery({
    queryKey: aiAgentKeys.detail(organizationId),
    queryFn: () => aiAgentRepository.get(organizationId),
    enabled: Boolean(organizationId),
  });
}

export function useUpdateAiAgent(organizationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Partial<AiAgentConfigUpdate>) =>
      aiAgentRepository.update(organizationId, input),

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: aiAgentKeys.detail(organizationId),
      });
    },
  });
}