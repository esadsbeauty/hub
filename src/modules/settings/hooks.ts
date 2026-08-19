import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { governanceRepository } from "./repository";
import { isLocalMode } from "@/config/app-mode";
import type { GovernanceData, MemberStatus } from "./types";

export const settingsKeys = { all: ["settings"] as const, governance: (page: number) => ["settings", "governance", page] as const, bootstrap: ["settings", "bootstrap"] as const };
export function useGovernance(page = 0) { return useQuery({ queryKey: settingsKeys.governance(page), queryFn: () => governanceRepository.list(page) }); }
export function useBootstrapStatus() { return useQuery({ queryKey: settingsKeys.bootstrap, queryFn: governanceRepository.bootstrapStatus, enabled: !isLocalMode, retry: false }); }
export function useGovernanceActions() { const client = useQueryClient(); const refresh = async () => { await client.invalidateQueries({ queryKey: settingsKeys.all }); }; return {
  changeRole: useMutation({ mutationFn: ({ memberId, roleId }: { memberId: string; roleId: string }) => governanceRepository.changeRole(memberId, roleId), onSuccess: refresh }),
  changeStatus: useMutation({ mutationFn: ({ memberId, status }: { memberId: string; status: MemberStatus }) => governanceRepository.changeStatus(memberId, status), onSuccess: refresh }),
  approveAccess: useMutation({ mutationFn: ({ memberId, roleId }: { memberId: string; roleId: string }) => governanceRepository.approveAccess(memberId, roleId), onSuccess: refresh }),
  rejectAccess: useMutation({ mutationFn: (memberId: string) => governanceRepository.rejectAccess(memberId), onSuccess: refresh }),
  updateOrganization: useMutation({ mutationFn: (input: Omit<GovernanceData["organization"], "id">) => governanceRepository.updateOrganization(input), onSuccess: refresh }),
  inviteUser: useMutation({ mutationFn: governanceRepository.inviteUser, onSuccess: refresh }),
  resendInvite: useMutation({ mutationFn: governanceRepository.resendInvite, onSuccess: refresh }),
  cancelInvite: useMutation({ mutationFn: governanceRepository.cancelInvite, onSuccess: refresh }),
  claimInitialOwner: useMutation({ mutationFn: governanceRepository.claimInitialOwner, onSuccess: refresh }),
}; }
