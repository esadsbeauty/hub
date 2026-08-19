import { isLocalMode } from "@/config/app-mode";
import type { BlogRepository } from "./repository-contract";
import { localBlogRepository } from "./repository";
import { supabaseBlogRepository } from "./supabase-repository";
export const blogDataSource:BlogRepository=isLocalMode?localBlogRepository:supabaseBlogRepository;
