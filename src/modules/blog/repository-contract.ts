import type { BlogCategory, BlogPost, BlogPostInput, BlogStatus, PublicBlogQuery, PublicBlogResult } from "./types";
export interface BlogRepository {
  listPublished(query: PublicBlogQuery): Promise<PublicBlogResult>;
  getPublished(slug: string): Promise<BlogPost | null>;
  listCategories(): Promise<BlogCategory[]>;
  listManaged(): Promise<BlogPost[]>;
  save(input: BlogPostInput): Promise<BlogPost>;
  setStatus(id: string, status: BlogStatus): Promise<void>;
  remove(id: string): Promise<void>;
  uploadCover(file: File): Promise<string>;
  coverUrl(path?: string): string | undefined;
}
