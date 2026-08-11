import type { FollowUpFormData, TaskFormData } from "./schema";
import type { Task } from "./types";

export interface CrmTaskRepository {
  createTask(input: TaskFormData): Promise<Task>;
  createFollowUp(
    companyId: string,
    input: FollowUpFormData,
    opportunityId?: string,
  ): Promise<Task>;
  updateFollowUp(id: string, input: Partial<FollowUpFormData>): Promise<void>;
  completeTask(id: string): Promise<Task>;
  rescheduleTask(id: string, dueAt: string): Promise<Task>;
  cancelTask(id: string): Promise<Task>;
}

export function defineCrmRepository<T extends CrmTaskRepository>(
  repository: T,
): T {
  return repository;
}
