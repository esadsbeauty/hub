import { isLocalMode } from "@/config/app-mode";
import type { MarketingRepository } from "./repository-contract";
import { marketingRepository } from "./repository";
import { supabaseMarketingRepository } from "./supabase-repository";
export const marketingDataSource: MarketingRepository = isLocalMode ? marketingRepository : supabaseMarketingRepository;
