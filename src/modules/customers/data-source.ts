import type { CustomerRepository } from "./repository-contract";
import { supabaseCustomerRepository } from "./supabase-repository";

export const customerDataSource: CustomerRepository = supabaseCustomerRepository;
