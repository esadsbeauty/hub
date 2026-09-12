import type { CostCenter, EntryInput, FinanceData, FinancialAccount, FinancialCategory, Payable, PayableInput, PaymentInput, Receivable, ReceivableInput, RecurrenceRule } from "./types";
export interface FinanceRepository {
 list():Promise<FinanceData>;
 createAccount(input:Pick<FinancialAccount,"name"|"type"|"initialBalance">&Partial<Pick<FinancialAccount,"bankName">>):Promise<FinancialAccount>;
 updateAccount(id:string,input:Pick<FinancialAccount,"name"|"type"|"bankName"|"isActive">):Promise<void>;
 createCategory(input:Pick<FinancialCategory,"name"|"type"|"dreGroup">&Partial<Pick<FinancialCategory,"parentId">>):Promise<FinancialCategory>;
 updateCategory(id:string,input:Pick<FinancialCategory,"name"|"isActive">):Promise<void>;
 createCostCenter(input:Pick<CostCenter,"name">&Partial<Pick<CostCenter,"description">>):Promise<CostCenter>;
 createReceivable(input:ReceivableInput):Promise<Receivable>;
 createPayable(input:PayableInput):Promise<Payable>;
 updateReceivable(id:string,input:ReceivableInput):Promise<void>;
 updatePayable(id:string,input:PayableInput):Promise<void>;
 cancelEntry(kind:"receivable"|"payable",id:string):Promise<void>;
 receivePayment(input:PaymentInput):Promise<void>;
 payExpense(input:PaymentInput):Promise<void>;
 reverseTransaction(id:string):Promise<void>;
 createRecurrence(input:Omit<RecurrenceRule,"id"|"organizationId"|"createdAt"|"updatedAt"|"cancelledAt">):Promise<RecurrenceRule>;
 generateRecurringEntries(ruleId:string,throughDate:string):Promise<number>;
 createInstallments(input:ReceivableInput&{installments:number}):Promise<Receivable[]>;
 createPayableInstallments(input:PayableInput&{installments:number}):Promise<Payable[]>;
}
