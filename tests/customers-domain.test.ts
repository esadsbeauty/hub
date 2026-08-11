import { describe, expect, test } from "bun:test";
import { isContractExpiring, isOnboardingStepOverdue, onboardingProgress } from "../src/modules/customers/domain";
import type { Contract, OnboardingStep } from "../src/modules/customers/types";

const step: OnboardingStep = { id:"s",organizationId:"o",onboardingId:"on",title:"Acesso",position:1,status:"pending",createdAt:"2026-08-01T00:00:00Z",updatedAt:"2026-08-01T00:00:00Z" };
const contract: Contract = { id:"c",organizationId:"o",customerAccountId:"a",title:"Contrato",status:"active",contractNumber:"CTR-1",startDate:"2026-01-01",endDate:"2026-09-01",billingType:"recurring",billingInterval:"monthly",autoRenew:false,noticeDays:30,customerServiceIds:[],createdAt:"2026-01-01T00:00:00Z",updatedAt:"2026-01-01T00:00:00Z" };

describe("customer success rules",()=>{
  test("progress is derived and excludes cancelled steps",()=>expect(onboardingProgress([step,{...step,id:"2",status:"completed"},{...step,id:"3",status:"cancelled"}])).toEqual({completed:1,total:2,percentage:50}));
  test("overdue is calculated instead of persisted",()=>expect(isOnboardingStepOverdue({...step,dueAt:"2026-08-10T12:00:00Z"},new Date("2026-08-11T00:00:00Z"))).toBe(true));
  test("expiration respects the selected horizon",()=>{expect(isContractExpiring(contract,30,new Date("2026-08-11T00:00:00Z"))).toBe(true);expect(isContractExpiring(contract,30,new Date("2026-07-01T00:00:00Z"))).toBe(false);});
});
