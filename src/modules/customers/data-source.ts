import { isLocalMode } from "@/config/app-mode";
import type { CustomerRepository } from "./repository-contract";
import { customerRepository } from "./repository";
import { supabaseCustomerRepository } from "./supabase-repository";

export const customerDataSource: CustomerRepository = isLocalMode ? customerRepository : supabaseCustomerRepository;
