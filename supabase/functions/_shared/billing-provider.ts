export type BillingCustomer={name:string;email?:string;phone?:string};
export type ExternalCustomer={id:string};
export type ChargeInput={customerId:string;amountCents:number;dueDate:string;description:string;externalReference:string};
export type ExternalCharge={id:string;status:string;value?:number;invoiceUrl?:string};
export type PixDetails={payload?:string;encodedImage?:string;expirationDate?:string};
export interface BillingProvider{name:string;createCustomer(input:BillingCustomer):Promise<ExternalCustomer>;createCharge(input:ChargeInput):Promise<ExternalCharge>;getCharge(id:string):Promise<ExternalCharge>;findChargeByExternalReference(reference:string):Promise<ExternalCharge|undefined>;getPix(id:string):Promise<PixDetails>;cancelCharge(id:string):Promise<void>}
