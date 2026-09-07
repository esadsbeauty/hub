import { describe,expect,test } from "bun:test";
import { readFileSync } from "node:fs";
import { isOpenStage,nextActionForOpportunity,nextActionState,prioritizedPendingActions } from "../src/modules/crm/next-action";
import type { Opportunity,PipelineStage,Task } from "../src/modules/crm/types";

const opportunity={id:"opp-a",organizationId:"org-a",companyId:"company-a",pipelineId:"pipeline-a",stageId:"open",title:"Botox",value:0,probability:20,status:"open",createdBy:"owner-a",createdAt:"2026-09-01T00:00:00Z",updatedAt:"2026-09-01T00:00:00Z",stageEnteredAt:"2026-09-01T00:00:00Z",deletedAt:null}as Opportunity;
const stages=[{id:"open",pipelineId:"pipeline-a",name:"Novo Lead",slug:"novo_lead",position:0,probability:20,isWon:false,isLost:false,createdAt:"",updatedAt:""},{id:"won",pipelineId:"pipeline-a",name:"Fechou",slug:"fechou",position:5,probability:100,isWon:true,isLost:false,createdAt:"",updatedAt:""},{id:"lost",pipelineId:"pipeline-a",name:"Perdido",slug:"perdido",position:6,probability:0,isWon:false,isLost:true,createdAt:"",updatedAt:""}]as PipelineStage[];
const task=(id:string,dueAt:string,organizationId="org-a"):Task=>({id,organizationId,companyId:"company-a",opportunityId:"opp-a",assignedTo:"owner-a",createdBy:"owner-a",title:id,description:"",type:"whatsapp",status:"pending",priority:"medium",dueAt,createdAt:"",updatedAt:"",deletedAt:null});
const now=new Date("2026-09-07T12:00:00Z");

describe("próxima ação operacional",()=>{
 test("aparece em oportunidade aberta",()=>expect(nextActionState(opportunity,stages,task("hoje","2026-09-07T14:00:00Z"),now)).toBe("today"));
 test("não é exigida em Fechou ou Perdido",()=>{expect(isOpenStage({...opportunity,stageId:"won",status:"won"},stages)).toBe(false);expect(nextActionState({...opportunity,stageId:"lost",status:"lost"},stages,undefined,now)).toBe("not_required")});
 test("classifica atrasada, futura e ausente",()=>{expect(nextActionState(opportunity,stages,task("atrasada","2026-09-06T10:00:00Z"),now)).toBe("overdue");expect(nextActionState(opportunity,stages,task("futura","2026-09-09T10:00:00Z"),now)).toBe("upcoming");expect(nextActionState(opportunity,stages,undefined,now)).toBe("missing")});
 test("ordena atrasados, hoje e próximos por data",()=>expect(prioritizedPendingActions([task("futuro","2026-09-09T09:00:00Z"),task("hoje","2026-09-07T15:00:00Z"),task("atrasado","2026-09-06T09:00:00Z")],now).map(item=>item.id)).toEqual(["atrasado","hoje","futuro"]));
 test("não aceita próxima ação de outro tenant",()=>expect(nextActionForOpportunity(opportunity,[task("tenant-b","2026-09-07T14:00:00Z","org-b")])).toBeUndefined());
 test("kanban mobile abre oportunidade, sinaliza estado e preserva mover",()=>{const mobile=readFileSync("src/modules/crm/components/mobile-crm-view.tsx","utf8"),crm=readFileSync("src/modules/crm/CrmPage.tsx","utf8");expect(mobile).toContain("<NextActionStatus");expect(mobile).toContain("onClick={open}");expect(mobile).toContain("onClick={move}");expect(crm).toContain("draggable");expect(crm).toContain("onDrop={() => dragging && onMove")});
 test("reutiliza tarefas e não adiciona migration",()=>{const repository=readFileSync("src/modules/crm/supabase-repository.ts","utf8");expect(repository).toContain('.eq("organization_id", profile.organization_id)');expect(readFileSync("src/modules/crm/next-action.ts","utf8")).toContain("task.organizationId === opportunity.organizationId")});
});
