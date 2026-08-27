import type { BlogRepository } from "./repository-contract";
import type { BlogCategory, BlogPost } from "./types";
import { blogSlug } from "./types";
const STORAGE="esads-hub-local-v1:blog";
type State={posts:BlogPost[];categories:BlogCategory[]};
const initialCategories=():BlogCategory[]=>["Vendas|vendas","Atendimento|atendimento","Gestão Comercial|gestao-comercial","Marketing|marketing","CRM|crm"].map((value,index)=>{const[name,slug]=value.split("|");return{id:`local-blog-category-${index+1}`,name,slug,createdAt:new Date(0).toISOString(),updatedAt:new Date(0).toISOString()}});
const empty=():State=>({posts:[],categories:initialCategories()});
const read=():State=>{const value=localStorage.getItem(STORAGE);if(!value)return empty();const state=JSON.parse(value) as State,categories=state.categories?.length?state.categories:initialCategories();return{...state,categories,posts:(state.posts??[]).map(post=>({...post,categories:post.categories?.length?post.categories:categories.filter(item=>item.id===post.categoryId)}))}};
const write=(state:State)=>localStorage.setItem(STORAGE,JSON.stringify(state));
const stamp=()=>new Date().toISOString();
export const localBlogRepository:BlogRepository={
 async listPublished({query="",category,page,pageSize}){const needle=query.toLowerCase();const all=read().posts.filter(p=>p.status==="published"&&(!needle||`${p.title} ${p.excerpt} ${p.categories.map(item=>item.name).join(" ")}`.toLowerCase().includes(needle))&&(!category||p.categories.some(item=>item.slug===category))).sort((a,b)=>(b.publishedAt??"").localeCompare(a.publishedAt??""));return{items:all.slice((page-1)*pageSize,page*pageSize),total:all.length}},
 async getPublished(slug){return read().posts.find(p=>p.slug===slug&&p.status==="published")??null},async listCategories(){return read().categories},async listManaged(){return read().posts},
 async save(input){const state=read(),now=stamp(),slug=blogSlug(input.slug||input.title),categories=state.categories.filter(c=>input.categoryIds?.includes(c.id));if(!categories.length)throw new Error("Selecione pelo menos uma categoria.");if(state.posts.some(p=>p.slug===slug&&p.id!==input.id))throw new Error("Este endereço já está em uso.");const existing=state.posts.find(p=>p.id===input.id);const primary=categories[0];const post:BlogPost={id:existing?.id??crypto.randomUUID(),status:existing?.status??"draft",authorName:"Admin ESADS Beauty",createdAt:existing?.createdAt??now,updatedAt:now,...existing,...input,slug,categories,categoryId:primary.id,categoryName:primary.name,categorySlug:primary.slug};state.posts=existing?state.posts.map(p=>p.id===post.id?post:p):[post,...state.posts];write(state);return post},
 async setStatus(id,status){const state=read(),post=state.posts.find(p=>p.id===id);if(!post)throw new Error("Artigo não encontrado.");if(status==="published"&&(post.content.trim().length<80||post.excerpt.trim().length<20))throw new Error("Complete o resumo e o conteúdo antes de publicar.");post.status=status;post.publishedAt=status==="published"?(post.publishedAt??stamp()):undefined;post.updatedAt=stamp();write(state)},
 async remove(id){const state=read();state.posts=state.posts.filter(p=>p.id!==id);write(state)},async uploadCover(){throw new Error("Upload requer o ambiente Supabase.")},coverUrl:path=>path,
};
