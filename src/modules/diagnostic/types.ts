export type DiagnosticCategory="acquisition"|"service"|"organization"|"follow_up"|"metrics"|"demand"|"marketing"|"financial_clarity";
export type AnswerKey="a"|"b"|"c"|"d";
export type DiagnosticAnswers=Record<string,AnswerKey>;
export type DiagnosticQuestion={key:string;category:DiagnosticCategory|"business_stage"|"primary_need";title:string;options:{key:AnswerKey;label:string}[]};
export type DiagnosticResult={totalScore:number;level:string;businessStage:string;categoryScores:Record<DiagnosticCategory,number>;primaryBottleneck:DiagnosticCategory;strongestArea:DiagnosticCategory;primaryNeed:string;recommendations:string[]};
export type DiagnosticLead={name:string;businessName:string;whatsapp:string;email:string;instagram:string;website?:string};
export type Attribution={utmSource?:string;utmMedium?:string;utmCampaign?:string;utmContent?:string;utmTerm?:string;landingUrl:string;referrer?:string};
export type DiagnosticSubmission={token:string;lead:DiagnosticLead;answers:DiagnosticAnswers;result:DiagnosticResult;createdAt:string};
