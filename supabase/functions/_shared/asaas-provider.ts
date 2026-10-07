import type{BillingCustomer,BillingProvider,ChargeInput,ExternalCharge,ExternalCustomer,PixDetails}from"./billing-provider.ts";
type Json=Record<string,unknown>;
export class AsaasPaymentProvider implements BillingProvider{
 readonly name="asaas";constructor(private apiKey:string,private baseUrl:string){}
 private async request<T>(path:string,init:RequestInit={}):Promise<T>{const response=await fetch(`${this.baseUrl.replace(/\/$/,"")}${path}`,{...init,headers:{"Content-Type":"application/json","access_token":this.apiKey,...init.headers},signal:AbortSignal.timeout(12_000)});const data=await response.json().catch(()=>({}))as Json;if(!response.ok)throw new Error(`provider_request_failed:${response.status}`);return data as T;}
 async createCustomer(input:BillingCustomer){return this.request<ExternalCustomer>("/customers",{method:"POST",body:JSON.stringify({name:input.name,email:input.email,mobilePhone:input.phone,notificationDisabled:false})});}
 async createCharge(input:ChargeInput){return this.request<ExternalCharge>("/payments",{method:"POST",body:JSON.stringify({customer:input.customerId,billingType:"PIX",value:input.amountCents/100,dueDate:input.dueDate,description:input.description,externalReference:input.externalReference})});}
 async findChargeByExternalReference(reference:string){const result=await this.request<{data?:ExternalCharge[]}>(`/payments?externalReference=${encodeURIComponent(reference)}`);return result.data?.[0];}
 async getCharge(id:string){return this.request<ExternalCharge>(`/payments/${encodeURIComponent(id)}`);}
 async getPix(id:string){return this.request<PixDetails>(`/payments/${encodeURIComponent(id)}/pixQrCode`);}
 async cancelCharge(id:string){await this.request(`/payments/${encodeURIComponent(id)}`,{method:"DELETE"});}
}
