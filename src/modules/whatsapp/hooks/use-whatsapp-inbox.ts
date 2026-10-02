import { useEffect } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAppState } from "@/shared/state/app-state-context";
import { whatsappRepository } from "../repository";

const INBOX_PAGE_SIZE = 25;

export const whatsappKeys = {
  inbox: (organizationId: string) =>
    ["whatsapp", organizationId, "inbox"] as const,

  messages: (
    organizationId: string,
    conversationId: string,
  ) =>
    [
      "whatsapp",
      organizationId,
      "messages",
      conversationId,
    ] as const,
};

export function useWhatsAppInbox() {
  const { organizationId } = useAppState();

  const query = useInfiniteQuery({
    queryKey: whatsappKeys.inbox(organizationId),

    queryFn: ({ pageParam }) =>
      whatsappRepository.inbox(
        organizationId,
        INBOX_PAGE_SIZE,
        pageParam,
      ),

    initialPageParam: 0,

    getNextPageParam: (lastPage) =>
      lastPage.hasMore
        ? lastPage.offset + lastPage.limit
        : undefined,

    enabled: Boolean(organizationId),

    staleTime: 15_000,
    gcTime: 5 * 60_000,

    refetchOnWindowFocus: false,
    refetchOnReconnect: true,

    retry: 1,

    select: (data) => {
      const firstPage = data.pages[0];
      const lastPage = data.pages[data.pages.length - 1];

      const seen = new Set<string>();
      const conversations = data.pages
        .flatMap((page) => page.conversations)
        .filter((conversation) => {
          if (seen.has(conversation.id)) {
            return false;
          }

          seen.add(conversation.id);
          return true;
        });

      return {
        pages: data.pages,
        pageParams: data.pageParams,
        connection: firstPage?.connection,
        conversations,
        total: lastPage?.total ?? firstPage?.total ?? conversations.length,
        hasMore: lastPage?.hasMore ?? false,
      };
    },
  });

  return query;
}

export function useWhatsAppMessages(
  conversationId?: string,
) {
  const { organizationId } = useAppState();

  return useQuery({
    queryKey: whatsappKeys.messages(
      organizationId,
      conversationId ?? "none",
    ),

    queryFn: () =>
      whatsappRepository.messages(
        organizationId,
        conversationId!,
      ),

    enabled: Boolean(
      organizationId &&
        conversationId,
    ),

    staleTime: 10_000,
    gcTime: 5 * 60_000,

    refetchOnWindowFocus: false,
    refetchOnReconnect: true,

    retry: 1,
  });
}

export function useWhatsAppRealtime() {
  const { organizationId } = useAppState();
  const cache = useQueryClient();

  useEffect(() => {
    if (!supabase || !organizationId) {
      return;
    }

    const client = supabase;

    const refreshInbox = () => {
      void cache.invalidateQueries({
        queryKey: whatsappKeys.inbox(
          organizationId,
        ),
      });
    };

    const channel = client
      .channel(
        `whatsapp-inbox:${organizationId}`,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "whatsapp_conversations",
          filter: `organization_id=eq.${organizationId}`,
        },
        refreshInbox,
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "whatsapp_messages",
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => {
          refreshInbox();

          const conversationId =
            String(
              (
                payload.new as Record<
                  string,
                  unknown
                >
              ).conversation_id ?? "",
            );

          if (!conversationId) {
            return;
          }

          void cache.invalidateQueries({
            queryKey: whatsappKeys.messages(
              organizationId,
              conversationId,
            ),
          });
        },
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [cache, organizationId]);
}

export function useSendWhatsAppMessage(
  conversationId?: string,
) {
  const { organizationId } = useAppState();
  const cache = useQueryClient();

  return useMutation({
    mutationFn: (text: string) => {
      if (!conversationId) {
        throw new Error(
          "Conversa não selecionada.",
        );
      }

      return whatsappRepository.sendMessage({
        organizationId,
        conversationId,
        text,
      });
    },

    onSuccess: async () => {
      await Promise.all([
        cache.invalidateQueries({
          queryKey: whatsappKeys.inbox(
            organizationId,
          ),
        }),

        conversationId
          ? cache.invalidateQueries({
              queryKey:
                whatsappKeys.messages(
                  organizationId,
                  conversationId,
                ),
            })
          : Promise.resolve(),
      ]);
    },
  });
}
