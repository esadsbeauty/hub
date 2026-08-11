import { supabase } from "@/lib/supabase";import type { FinanceRepository } from "./repository-contract";import { financeRepository } from "./repository";import { supabaseFinanceRepository } from "./supabase-repository";
export const financeDataSource:FinanceRepository=supabase?supabaseFinanceRepository:financeRepository;
