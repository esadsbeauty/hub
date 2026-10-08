import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { useAppState } from "@/shared/state/app-state-context";
import {
  createProspectingList,
  generateProspectingMessage,
  listProspectingLeads,
  listProspectingLists,
  markProspectingMessageOpened,
  updateProspectingMessage,
  type ProspectingLead,
  type ProspectingList,
} from "./prospecting-repository";
import type { ProspectingImportRow } from "./prospecting-import";

const prospectingKeys = {
  lists: (organizationId: string) =>
    ["prospecting", "lists", organizationId] as const,

  leads: (
    organizationId: string,
    listId: string,
  ) =>
    [
      "prospecting",
      "leads",
      organizationId,
      listId,
    ] as const,
};

export function useProspectingLists() {
  const {
    organizationId,
    authorizationLoading,
  } = useAppState();

  return useQuery<ProspectingList[]>({
    queryKey:
      prospectingKeys.lists(
        organizationId,
      ),

    queryFn: () =>
      listProspectingLists(
        organizationId,
      ),

    enabled:
      !authorizationLoading &&
      Boolean(organizationId),
  });
}

export function useProspectingLeads(
  listId: string | null,
) {
  const {
    organizationId,
    authorizationLoading,
  } = useAppState();

  return useQuery<ProspectingLead[]>({
    queryKey:
      prospectingKeys.leads(
        organizationId,
        listId ?? "",
      ),

    queryFn: () =>
      listProspectingLeads(
        organizationId,
        listId ?? "",
      ),

    enabled:
      !authorizationLoading &&
      Boolean(organizationId) &&
      Boolean(listId),
  });
}

export function useCreateProspectingList() {
  const { organizationId } =
    useAppState();

  const queryClient =
    useQueryClient();

  return useMutation({
    mutationFn: (input: {
      name: string;
      description?: string;
      sourceType:
        | "csv"
        | "paste";
      rows: ProspectingImportRow[];
    }) =>
      createProspectingList({
        organizationId,
        ...input,
      }),

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey:
          prospectingKeys.lists(
            organizationId,
          ),
      });
    },
  });
}

export function useGenerateProspectingMessage(
  listId: string,
) {
  const { organizationId } =
    useAppState();

  const queryClient =
    useQueryClient();

  return useMutation({
    mutationFn: (leadId: string) =>
      generateProspectingMessage(
        organizationId,
        leadId,
      ),

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey:
          prospectingKeys.leads(
            organizationId,
            listId,
          ),
      });
    },
  });
}

export function useUpdateProspectingMessage(
  listId: string,
) {
  const { organizationId } =
    useAppState();

  const queryClient =
    useQueryClient();

  return useMutation({
    mutationFn: (input: {
      leadId: string;
      message: string;
    }) =>
      updateProspectingMessage(
        organizationId,
        input.leadId,
        input.message,
      ),

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey:
          prospectingKeys.leads(
            organizationId,
            listId,
          ),
      });
    },
  });
}

export function useMarkProspectingMessageOpened(
  listId: string,
) {
  const { organizationId } =
    useAppState();

  const queryClient =
    useQueryClient();

  return useMutation({
    mutationFn: (leadId: string) =>
      markProspectingMessageOpened(
        organizationId,
        leadId,
      ),

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey:
          prospectingKeys.leads(
            organizationId,
            listId,
          ),
      });
    },
  });
}