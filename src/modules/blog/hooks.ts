import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { blogDataSource } from "./data-source";
import { blogKeys } from "./query-keys";
import type { BlogPostInput, BlogStatus, PublicBlogQuery } from "./types";
export const usePublicPosts=(query:PublicBlogQuery)=>useQuery({queryKey:blogKeys.public(query),queryFn:()=>blogDataSource.listPublished(query),staleTime:5*60_000});
export const usePublicPost=(slug:string)=>useQuery({queryKey:blogKeys.post(slug),queryFn:()=>blogDataSource.getPublished(slug),staleTime:5*60_000});
export const useBlogCategories=()=>useQuery({queryKey:blogKeys.categories,queryFn:blogDataSource.listCategories,staleTime:5*60_000});
export const useManagedPosts=()=>useQuery({queryKey:blogKeys.managed,queryFn:blogDataSource.listManaged});
export function useBlogActions(){const client=useQueryClient(),refresh=()=>client.invalidateQueries({queryKey:blogKeys.all});return{save:useMutation({mutationFn:(input:BlogPostInput)=>blogDataSource.save(input),onSuccess:refresh}),status:useMutation({mutationFn:({id,status}:{id:string;status:BlogStatus})=>blogDataSource.setStatus(id,status),onSuccess:refresh}),remove:useMutation({mutationFn:(id:string)=>blogDataSource.remove(id),onSuccess:refresh}),upload:useMutation({mutationFn:(file:File)=>blogDataSource.uploadCover(file)})}}
