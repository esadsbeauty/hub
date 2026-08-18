import type { FinanceRepository } from "./repository-contract";import { supabaseFinanceRepository } from "./supabase-repository";
export const financeDataSource:FinanceRepository=supabaseFinanceRepository;
