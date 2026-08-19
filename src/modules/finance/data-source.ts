import { isLocalMode } from "@/config/app-mode";
import type { FinanceRepository } from "./repository-contract";
import { financeRepository } from "./repository";
import { supabaseFinanceRepository } from "./supabase-repository";
export const financeDataSource: FinanceRepository = isLocalMode ? financeRepository : supabaseFinanceRepository;
