import { useQuery } from "@tanstack/react-query";
import { subscriptionRepository } from "./repository";
export const subscriptionAccessKey=["current-subscription-access"]as const;
export function useSubscriptionAccess(enabled=true){return useQuery({queryKey:subscriptionAccessKey,queryFn:subscriptionRepository.access,enabled,staleTime:10_000,refetchInterval:30_000,refetchOnWindowFocus:true,retry:1});}
