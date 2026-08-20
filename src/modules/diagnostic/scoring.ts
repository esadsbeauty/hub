import{categoryContent}from"./content";import{diagnosticQuestions}from"./questions";import type{AnswerKey,DiagnosticAnswers,DiagnosticCategory,DiagnosticResult}from"./types";
const categories:DiagnosticCategory[]=["acquisition","service","organization","follow_up","metrics","demand","marketing","financial_clarity"];
const points:Record<AnswerKey,number>={a:1,b:2,c:3,d:4};
export function calculateDiagnosticResult(answers:DiagnosticAnswers):DiagnosticResult{
 const missing=diagnosticQuestions.filter(question=>!answers[question.key]);if(missing.length)throw new Error("Responda todas as perguntas para continuar.");
 const categoryScores=Object.fromEntries(categories.map(category=>[category,(points[answers[category]]-1)/3*100]))as Record<DiagnosticCategory,number>;
 const ordered=[...categories].sort((a,b)=>categoryScores[a]-categoryScores[b]||categories.indexOf(a)-categories.indexOf(b));
 const totalScore=Math.round(categories.reduce((sum,key)=>sum+categoryScores[key],0)/categories.length);
 const level=totalScore<=30?"Começando a construir a base":totalScore<=50?"Fase de estruturação":totalScore<=70?"Negócio em desenvolvimento":totalScore<=85?"Negócio em crescimento":"Base bem estruturada";
 const stage={a:"Começando",b:"Em desenvolvimento",c:"Em crescimento",d:"Em estruturação"}[answers.business_stage];
 const need={a:"Conseguir mais clientes",b:"Transformar mais conversas em agendamentos",c:"Organizar contatos e rotina",d:"Ganhar estabilidade e faturar mais"}[answers.primary_need];
 return{totalScore,level,businessStage:stage,categoryScores,primaryBottleneck:ordered[0],strongestArea:ordered.at(-1)!,primaryNeed:need,recommendations:ordered.slice(0,3).map(key=>categoryContent[key].recommendation)};
}
