import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/shared/components/feedback/toast";
import { crmDataSource } from "./data-source";
import { crmKeys } from "./query-keys";
import type {
  ActivityFormData,
  CompanyFormData,
  ContactFormData,
  FollowUpFormData,
  LostOpportunityFormData,
  OpportunityFormData,
  TaskFormData,
} from "./schema";
import type { CompanyFile, CrmData, Task } from "./types";

type WithCompany<T> = { companyId: string; data: T; opportunityId?: string };
export function useCrmData() {
  return useQuery({ queryKey: crmKeys.all, queryFn: crmDataSource.list });
}
export function useCompany(companyId: string) {
  const query = useCrmData();
  return {
    ...query,
    data: query.data?.companies.find(
      (item) => item.id === companyId && !item.deletedAt,
    ),
  };
}
export function useTasksRange(from: string, to: string) {
  return useQuery({
    queryKey: crmKeys.tasksRange(from, to),
    queryFn: () => crmDataSource.listTasksRange(from, to),
  });
}
export function useOverdueTasks(until: string) {
  return useQuery({
    queryKey: crmKeys.tasksOverdue(until),
    queryFn: () => crmDataSource.listOverdueTasks(until),
  });
}
export function useCrmActions() {
  const client = useQueryClient();
  const { notify } = useToast();
  const onError = (error: Error) =>
    notify({
      title: "Não foi possível concluir",
      description: error.message || "Tente novamente em alguns instantes.",
    });
  const refresh = () =>
    client.invalidateQueries({ queryKey: crmKeys.all, exact: true });
  return {
    createCompany: useMutation({
      mutationFn: crmDataSource.createCompany,
      onSuccess: refresh,
      onError,
    }),
    updateCompany: useMutation({
      mutationFn: ({
        id,
        data,
      }: {
        id: string;
        data: Partial<CompanyFormData>;
      }) => crmDataSource.updateCompany(id, data),
      onSuccess: refresh,
      onError,
    }),
    deleteCompany: useMutation({
      mutationFn: crmDataSource.deleteCompany,
      onSuccess: refresh,
      onError,
    }),
    duplicateCompany: useMutation({
      mutationFn: crmDataSource.duplicateCompany,
      onSuccess: refresh,
      onError,
    }),
    createOpportunity: useMutation({
      mutationFn: crmDataSource.createOpportunity,
      onSuccess: refresh,
      onError,
    }),
    updateOpportunity: useMutation({
      mutationFn: ({
        id,
        data,
      }: {
        id: string;
        data: Partial<OpportunityFormData>;
      }) => crmDataSource.updateOpportunity(id, data),
      onSuccess: refresh,
      onError,
    }),
    duplicateOpportunity: useMutation({
      mutationFn: crmDataSource.duplicateOpportunity,
      onSuccess: refresh,
      onError,
    }),
    archiveOpportunity: useMutation({
      mutationFn: crmDataSource.archiveOpportunity,
      onSuccess: refresh,
      onError,
    }),
    markOpportunityWon: useMutation({
      mutationFn: crmDataSource.markOpportunityWon,
      onSuccess: refresh,
      onError,
    }),
    markOpportunityLost: useMutation({
      mutationFn: ({
        id,
        data,
      }: {
        id: string;
        data: LostOpportunityFormData;
      }) => crmDataSource.markOpportunityLost(id, data),
      onSuccess: refresh,
      onError,
    }),
    moveOpportunity: useMutation({
      mutationFn: ({
        opportunityId,
        stageId,
      }: {
        opportunityId: string;
        stageId: string;
      }) => crmDataSource.moveOpportunity(opportunityId, stageId),
      onMutate: async ({ opportunityId, stageId }) => {
        await client.cancelQueries({ queryKey: crmKeys.all });
        const previous = client.getQueryData<CrmData>(crmKeys.all);
        if (previous)
          client.setQueryData<CrmData>(crmKeys.all, {
            ...previous,
            opportunities: previous.opportunities.map((item) =>
              item.id === opportunityId ? { ...item, stageId } : item,
            ),
          });
        return { previous };
      },
      onError: (error, _variables, context) => {
        if (context?.previous)
          client.setQueryData(crmKeys.all, context.previous);
        onError(error);
      },
      onSettled: refresh,
    }),
    createContact: useMutation({
      mutationFn: ({ companyId, data }: WithCompany<ContactFormData>) =>
        crmDataSource.createContact(companyId, data),
      onSuccess: refresh,
      onError,
    }),
    updateContact: useMutation({
      mutationFn: ({
        id,
        data,
      }: {
        id: string;
        data: Partial<ContactFormData>;
      }) => crmDataSource.updateContact(id, data),
      onSuccess: refresh,
      onError,
    }),
    deleteContact: useMutation({
      mutationFn: crmDataSource.deleteContact,
      onSuccess: refresh,
      onError,
    }),
    createTask: useMutation({
      mutationFn: (data: TaskFormData) => crmDataSource.createTask(data),
      onSuccess: async () => {
        await client.invalidateQueries({ queryKey: [...crmKeys.all, "tasks"] });
        await refresh();
      },
      onError,
    }),
    createFollowUp: useMutation({
      mutationFn: ({
        companyId,
        data,
        opportunityId,
      }: WithCompany<FollowUpFormData>) =>
        crmDataSource.createFollowUp(companyId, data, opportunityId),
      onSuccess: refresh,
      onError,
    }),
    updateFollowUp: useMutation({
      mutationFn: ({
        id,
        data,
      }: {
        id: string;
        data: Partial<FollowUpFormData>;
      }) => crmDataSource.updateFollowUp(id, data),
      onSuccess: refresh,
      onError,
    }),
    completeTask: useMutation({
      mutationFn: crmDataSource.completeTask,
      onMutate: async (taskId) => {
        await client.cancelQueries({ queryKey: [...crmKeys.all, "tasks"] });
        const previous = client.getQueryData<CrmData>(crmKeys.all);
        if (previous)
          client.setQueryData<CrmData>(crmKeys.all, {
            ...previous,
            tasks: previous.tasks.map((task) =>
              task.id === taskId
                ? {
                    ...task,
                    status: "completed",
                    completedAt: new Date().toISOString(),
                  }
                : task,
            ),
          });
        client.setQueriesData<Task[]>(
          { queryKey: [...crmKeys.all, "tasks", "range"] },
          (tasks) =>
            tasks?.map((task) =>
              task.id === taskId
                ? {
                    ...task,
                    status: "completed",
                    completedAt: new Date().toISOString(),
                  }
                : task,
            ),
        );
        return { previous };
      },
      onError: (error, _taskId, context) => {
        if (context?.previous)
          client.setQueryData(crmKeys.all, context.previous);
        onError(error);
      },
      onSettled: async () => {
        await client.invalidateQueries({ queryKey: [...crmKeys.all, "tasks"] });
        await refresh();
      },
    }),
    rescheduleTask: useMutation({
      mutationFn: ({ id, dueAt }: { id: string; dueAt: string }) =>
        crmDataSource.rescheduleTask(id, dueAt),
      onSuccess: async () => {
        await client.invalidateQueries({ queryKey: [...crmKeys.all, "tasks"] });
        await refresh();
      },
      onError,
    }),
    cancelTask: useMutation({
      mutationFn: crmDataSource.cancelTask,
      onSuccess: async () => {
        await client.invalidateQueries({ queryKey: [...crmKeys.all, "tasks"] });
        await refresh();
      },
      onError,
    }),
    createActivity: useMutation({
      mutationFn: ({ companyId, data }: WithCompany<ActivityFormData>) =>
        crmDataSource.createActivity(companyId, data),
      onSuccess: refresh,
      onError,
    }),
    addNote: useMutation({
      mutationFn: ({
        companyId,
        text,
        opportunityId,
      }: {
        companyId: string;
        text: string;
        opportunityId?: string;
      }) => crmDataSource.addNote(companyId, text, opportunityId),
      onSuccess: refresh,
      onError,
    }),
    addFile: useMutation({
      mutationFn: ({
        companyId,
        file,
      }: {
        companyId: string;
        file: Omit<
          CompanyFile,
          "id" | "organizationId" | "companyId" | "user" | "createdAt"
        >;
      }) => crmDataSource.addFile(companyId, file),
      onSuccess: refresh,
      onError,
    }),
  };
}
