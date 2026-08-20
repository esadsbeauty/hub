import type{DiagnosticCategory}from"./types";
export const categoryContent:Record<DiagnosticCategory,{label:string;discovery:string;positive:string;recommendation:string}>={
acquisition:{label:"Atração de clientes",discovery:"Seu negócio pode ganhar mais estabilidade criando formas constantes e simples de ser encontrado por novas pessoas.",positive:"Você já começou a construir caminhos para que mais pessoas conheçam seu trabalho.",recommendation:"Escolha uma forma de divulgação e mantenha uma rotina simples por quatro semanas."},
service:{label:"Atendimento",discovery:"Responder com clareza e rapidez ajuda uma pessoa interessada a se sentir segura para agendar.",positive:"Você demonstra cuidado com as pessoas que entram em contato.",recommendation:"Prepare respostas claras para as dúvidas mais comuns sobre serviços, horários e valores."},
organization:{label:"Organização",discovery:"Alguns contatos podem estar se perdendo entre conversas. Reunir essas pessoas em um só lugar facilita os próximos passos.",positive:"Você já percebe a importância de organizar contatos e clientes.",recommendation:"Registre nome, contato, interesse e próximo passo de cada pessoa que pedir informações."},
follow_up:{label:"Acompanhamento",discovery:"Pessoas interessadas podem desaparecer sem uma nova conversa. Um acompanhamento gentil pode recuperar oportunidades que já chegaram até você.",positive:"Você já procura manter contato com quem demonstrou interesse.",recommendation:"Reserve dois momentos da semana para chamar novamente quem pediu informações e ainda não agendou."},
metrics:{label:"Visão do negócio",discovery:"Acompanhar poucos números simples ajuda a entender o que está funcionando e onde agir primeiro.",positive:"Você já busca entender melhor os resultados do seu negócio.",recommendation:"Anote semanalmente quantas pessoas pediram informações, agendaram e realmente compareceram."},
demand:{label:"Agenda e demanda",discovery:"Sua agenda ainda pode ganhar mais regularidade com ações consistentes de divulgação e acompanhamento.",positive:"Sua agenda já mostra sinais importantes de procura pelos seus serviços.",recommendation:"Identifique os horários mais vazios e crie uma ação específica para preenchê-los."},
marketing:{label:"Divulgação",discovery:"Uma presença mais constante ajuda as pessoas a lembrarem do seu trabalho no momento em que precisam.",positive:"Você já está apresentando seu trabalho para novas pessoas.",recommendation:"Crie uma rotina possível de divulgação com resultados, bastidores e explicações dos serviços."},
financial_clarity:{label:"Clareza financeira",discovery:"Ter uma meta mensal simples ajuda a decidir quantos atendimentos são necessários e quais ações priorizar.",positive:"Você já começou a olhar para metas e sustentabilidade do negócio.",recommendation:"Liste seus custos e defina uma meta mensal de faturamento e quantidade de atendimentos."},
};
export const discoveryCards=[
["Como você está conseguindo clientes","Entenda se o negócio depende somente de indicações ou já atrai novas pessoas com frequência."],
["Como está seu atendimento","Veja como você recebe quem entra em contato pelo Instagram ou WhatsApp."],
["Como está sua organização","Entenda se contatos e clientes estão organizados ou podem se perder pelo caminho."],
["Como está sua agenda","Identifique se existe uma procura constante ou muitos períodos vazios."],
["Como está sua visão financeira","Veja se existe clareza sobre faturamento e metas."],
["Qual deve ser sua prioridade agora","Receba uma indicação simples dos pontos que merecem mais atenção."],
];
