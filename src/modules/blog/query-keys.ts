import type { PublicBlogQuery } from "./types";
export const blogKeys={all:["blog"] as const,public:(query:PublicBlogQuery)=>["blog","public",query] as const,post:(slug:string)=>["blog","post",slug] as const,categories:["blog","categories"] as const,managed:["blog","managed"] as const};
