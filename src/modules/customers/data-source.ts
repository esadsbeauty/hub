import { supabase } from "@/lib/supabase";
import type { CustomerRepository } from "./repository-contract";
import { customerRepository } from "./repository";
import { supabaseCustomerRepository } from "./supabase-repository";

export const customerDataSource: CustomerRepository = supabase ? supabaseCustomerRepository : customerRepository;
