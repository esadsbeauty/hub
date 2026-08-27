export type BlogStatus = "draft" | "published" | "archived";
export type BlogCategory = { id: string; name: string; slug: string; createdAt: string; updatedAt: string };
export type BlogPost = {
  id: string; title: string; slug: string; excerpt: string; content: string; coverImagePath?: string;
  categories: BlogCategory[]; categoryId?: string; categoryName?: string; categorySlug?: string; status: BlogStatus; authorId?: string;
  authorName: string; publishedAt?: string; seoTitle?: string; seoDescription?: string; createdAt?: string; updatedAt?: string;
};
export type BlogPostInput = Pick<BlogPost,"title"|"slug"|"excerpt"|"content"> & Partial<Pick<BlogPost,"id"|"coverImagePath"|"seoTitle"|"seoDescription">> & { categoryIds?: string[] };
export type PublicBlogQuery = { query?: string; category?: string; page: number; pageSize: number };
export type PublicBlogResult = { items: BlogPost[]; total: number };
export const readingMinutes = (content: string) => Math.max(1, Math.ceil(content.trim().split(/\s+/).filter(Boolean).length / 210));
export const blogSlug = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
