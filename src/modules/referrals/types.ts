export type ReferralStatus="lead"|"qualified"|"customer"|"rewarded"|"invalid"|"cancelled";
export type ReferralItem={id:string;referredName:string;code:string;status:ReferralStatus;createdAt:string;rewardCents?:number;referredOrganizationId?:string};
export type ReferralDashboard={code:string;link:string;total:number;converted:number;availableCredits:number;appliedCredits:number;items:ReferralItem[]};
export type PlatformReferralSnapshot={items:(ReferralItem&{referrerOrganization:string;referredOrganization?:string;creditStatus?:string})[]};
