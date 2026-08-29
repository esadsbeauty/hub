import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { useToast } from "@/shared/components/feedback/toast";
import { onboardingKey } from "@/modules/onboarding/hooks";
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
type CompleteTaskContext = {
  previous?: CrmData;
  previousTaskRanges: [QueryKey, Task[] | undefined][];
};
function optimisticCompletedTask(
  task: Task,
  taskId: string,
  completedAt: string,
): Task {
  return task.id === taskId
    ? { ...task, status: "completed", completedAt }
    : task;
}
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
  const refreshTasks = async () => {
    await client.invalidateQueries({ queryKey: crmKeys.taskOperations() });
    await refresh();
  };
  return {
    createCompany: useMutation({
      mutationFn: crmDataSource.createCompany,
      onSuccess: async () => {
        await refresh();
        await client.invalidateQueries({ queryKey: onboardingKey });
      },
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
      onSuccess: async () => {
        await client.invalidateQueries({ queryKey: ["customers"] });
        await refresh();
      },
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
      onSuccess: refreshTasks,
      onError,
    }),
    createFollowUp: useMutation({
      mutationFn: ({
        companyId,
        data,
        opportunityId,
      }: WithCompany<FollowUpFormData>) =>
        crmDataSource.createFollowUp(companyId, data, opportunityId),
      onSuccess: refreshTasks,
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
      onSuccess: refreshTasks,
      onError,
    }),
    completeTask: useMutation<Task, Error, string, CompleteTaskContext>({
      mutationFn: (taskId) => crmDataSource.completeTask(taskId),
      onMutate: async (taskId) => {
        await client.cancelQueries({ queryKey: crmKeys.taskOperations() });
        const previous = client.getQueryData<CrmData>(crmKeys.all);
        const previousTaskRanges = client.getQueriesData<Task[]>({
          queryKey: crmKeys.taskRanges(),
        });
        const completedAt = new Date().toISOString();
        if (previous)
          client.setQueryData<CrmData>(crmKeys.all, {
            ...previous,
            tasks: previous.tasks.map((task) =>
              optimisticCompletedTask(task, taskId, completedAt),
            ),
          });
        client.setQueriesData<Task[]>(
          { queryKey: crmKeys.taskRanges() },
          (tasks) =>
            tasks?.map((task) =>
              optimisticCompletedTask(task, taskId, completedAt),
            ),
        );
        return { previous, previousTaskRanges };
      },
      onError: (error, _taskId, context) => {
        if (context?.previous)
          client.setQueryData(crmKeys.all, context.previous);
        context?.previousTaskRanges.forEach(([queryKey, tasks]) =>
          client.setQueryData(queryKey, tasks),
        );
        onError(error);
      },
      onSettled: refreshTasks,
    }),
    rescheduleTask: useMutation<Task, Error, { id: string; dueAt: string }>({
      mutationFn: ({ id, dueAt }: { id: string; dueAt: string }) =>
        crmDataSource.rescheduleTask(id, dueAt),
      onSuccess: refreshTasks,
      onError,
    }),
    cancelTask: useMutation<Task, Error, string>({
      mutationFn: (taskId) => crmDataSource.cancelTask(taskId),
      onSuccess: refreshTasks,
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
