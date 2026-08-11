import type { CostCenter, EntryInput, FinanceData, FinancialAccount, FinancialCategory, Payable, PayableInput, PaymentInput, Receivable, ReceivableInput, RecurrenceRule } from "./types";
export interface FinanceRepository {
 list():Promise<FinanceData>;
 createAccount(input:Pick<FinancialAccount,"name"|"type"|"initialBalance">&Partial<Pick<FinancialAccount,"bankName">>):Promise<FinancialAccount>;
 createCategory(input:Pick<FinancialCategory,"name"|"type"|"dreGroup">&Partial<Pick<FinancialCategory,"parentId">>):Promise<FinancialCategory>;
 createCostCenter(input:Pick<CostCenter,"name">&Partial<Pick<CostCenter,"description">>):Promise<CostCenter>;
 createReceivable(input:ReceivableInput):Promise<Receivable>;
 createPayable(input:PayableInput):Promise<Payable>;
 receivePayment(input:PaymentInput):Promise<void>;
 payExpense(input:PaymentInput):Promise<void>;
 reverseTransaction(id:string):Promise<void>;
 createRecurrence(input:Omit<RecurrenceRule,"id"|"organizationId"|"createdAt"|"updatedAt"|"cancelledAt">):Promise<RecurrenceRule>;
 generateRecurringEntries(ruleId:string,throughDate:string):Promise<number>;
 createInstallments(input:ReceivableInput&{installments:number}):Promise<Receivable[]>;
}
