import { beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { ESADS_WHATSAPP_URL, diagnosticWhatsappUrl } from "../src/config/contact";
import { localBlogRepository } from "../src/modules/blog/repository";
import { crmRepository } from "../src/modules/crm/repository";
import { calculateAnalytics } from "../src/modules/analytics/analytics-service";

const memory = new Map<string,string>();
Object.defineProperty(globalThis,"localStorage",{value:{getItem:(key:string)=>memory.get(key)??null,setItem:(key:string,value:string)=>memory.set(key,value),removeItem:(key:string)=>memory.delete(key),clear:()=>memory.clear()}});

beforeEach(()=>memory.clear());

describe("pacote de crescimento",()=>{
 test("centraliza o WhatsApp oficial com DDI do Brasil",()=>{expect(ESADS_WHATSAPP_URL).toBe("https://wa.me/5575991355513");expect(diagnosticWhatsappUrl("Maria",80)).toStartWith("https://wa.me/5575991355513?text=")});
 test("blog salva uma categoria, múltiplas categorias, edita e filtra sem duplicar",async()=>{const categories=await localBlogRepository.listCategories();const base={title:"Estratégia comercial para estética",slug:"estrategia-comercial",excerpt:"Resumo completo para publicação do artigo.",content:"Conteúdo editorial ".repeat(12)};const one=await localBlogRepository.save({...base,categoryIds:[categories[0].id]});expect(one.categories).toHaveLength(1);const multiple=await localBlogRepository.save({...one,categoryIds:[categories[0].id,categories[1].id]});expect(multiple.categories).toHaveLength(2);await localBlogRepository.setStatus(one.id,"published");expect((await localBlogRepository.listPublished({category:categories[1].slug,page:1,pageSize:9})).items.map(item=>item.id)).toEqual([one.id]);const edited=await localBlogRepository.save({...multiple,categoryIds:[categories[2].id]});expect(edited.categories.map(item=>item.id)).toEqual([categories[2].id])});
 test("conversão ganha exige e persiste valor fechado usado pelos indicadores",async()=>{const company=await crmRepository.createCompany({fantasyName:"Clínica",temperature:"morno",priority:"media"});const data=await crmRepository.list();const opportunity=data.opportunities.find(item=>item.companyId===company.id)!;await crmRepository.markOpportunityWon(opportunity.id,{value:3500});const reloaded=await crmRepository.list();const won=reloaded.opportunities.find(item=>item.id===opportunity.id)!;expect(won.value).toBe(3500);expect(won.status).toBe("won");expect(reloaded.companies.find(item=>item.id===company.id)?.lifecycleStage).toBe("customer");const analytics=calculateAnalytics(reloaded,{period:"custom",from:"2000-01-01",to:"2100-01-01"});expect(analytics.won.value).toBe(3500)});
 test("migration do diagnóstico cria uma oportunidade por submissão no primeiro estágio e mantém idempotência",()=>{const sql=readFileSync("supabase/migrations/202608270002_diagnostic_opportunity_and_closed_value.sql","utf8");expect(sql).toContain("pg_advisory_xact_lock");expect(sql).toContain("idempotency_key=idem");expect(sql).toContain("create_diagnostic_crm");expect(sql).toContain("order by position,id limit 1");expect(sql).toContain("'Diagnóstico ESADS Beauty'")});
 test("migration multi-categoria preserva associações e aplica isolamento por organização",()=>{const sql=readFileSync("supabase/migrations/202608270001_blog_multi_category.sql","utf8");expect(sql).toContain("primary key(post_id,category_id)");expect(sql).toContain("select id,category_id from public.blog_posts");expect(sql).toContain("enable row level security");expect(sql).toContain("current_organization_id()")});
});
