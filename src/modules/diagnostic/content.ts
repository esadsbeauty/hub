import type{DiagnosticCategory}from"./types";
export const categoryContent:Record<DiagnosticCategory,{label:string;discovery:string;positive:string;recommendation:string}>={
acquisition:{label:"Origem de novas clientes",discovery:"Depender de um único canal ou não ter uma fonte constante de novas clientes pode deixar sua agenda imprevisível.",positive:"Você já tem um caminho para alcançar possíveis clientes.",recommendation:"Identifique qual canal trouxe suas últimas dez clientes e teste uma segunda fonte de procura de forma consistente."},
service:{label:"Conversão em agendamentos",discovery:"Receber perguntas não significa preencher a agenda. Entender quantas interessadas realmente agendam ajuda a melhorar seu atendimento.",positive:"Você já consegue transformar parte do interesse em agendamentos.",recommendation:"Anote quantas interessadas pediram informações e quantas agendaram. Teste uma resposta clara com convite para marcar um horário."},
organization:{label:"Organização",discovery:"Alguns contatos podem estar se perdendo entre conversas. Reunir essas pessoas em um só lugar facilita os próximos passos.",positive:"Você já percebe a importância de organizar contatos e clientes.",recommendation:"Registre nome, contato, interesse e próximo passo de cada pessoa que pedir informações."},
follow_up:{label:"Acompanhamento",discovery:"Pessoas interessadas podem desaparecer sem uma nova conversa. Um acompanhamento gentil pode recuperar oportunidades que já chegaram até você.",positive:"Você já procura manter contato com quem demonstrou interesse.",recommendation:"Reserve dois momentos da semana para chamar novamente quem pediu informações e ainda não agendou."},
metrics:{label:"Visão do negócio",discovery:"Acompanhar poucos números simples ajuda a entender o que está funcionando e onde agir primeiro.",positive:"Você já busca entender melhor os resultados do seu negócio.",recommendation:"Anote semanalmente quantas pessoas pediram informações, agendaram e realmente compareceram."},
demand:{label:"Agenda e demanda",discovery:"Sua agenda ainda pode ganhar mais regularidade com ações consistentes de divulgação e acompanhamento.",positive:"Sua agenda já mostra sinais importantes de procura pelos seus serviços.",recommendation:"Identifique os horários mais vazios e crie uma ação específica para preenchê-los."},
marketing:{label:"Divulgação",discovery:"Uma presença mais constante ajuda as pessoas a lembrarem do seu trabalho no momento em que precisam.",positive:"Você já está apresentando seu trabalho para novas pessoas.",recommendation:"Crie uma rotina possível de divulgação com resultados, bastidores e explicações dos serviços."},
financial_clarity:{label:"Clareza financeira",discovery:"Ter uma meta mensal simples ajuda a decidir quantos atendimentos são necessários e quais ações priorizar.",positive:"Você já começou a olhar para metas e sustentabilidade do negócio.",recommendation:"Liste seus custos e defina uma meta mensal de faturamento e quantidade de atendimentos."},
};
export const discoveryCards=[
["Como você está conseguindo clientes","Entenda se o negócio depende somente de indicações ou já atrai novas pessoas com frequência."],
["Conversas que viram agendamentos","Entenda se o interesse que chega ao WhatsApp realmente se transforma em horários marcados."],
["Como acompanha interessadas","Veja se existe um processo para retomar conversas que não geraram agendamento."],
["Como está sua agenda","Identifique se existe uma procura constante ou muitos períodos vazios."],
["Seu objetivo nos próximos 3 meses","Receba uma orientação conforme aquilo que você mais deseja melhorar."],
["Qual deve ser sua prioridade agora","Receba uma indicação simples dos pontos que merecem mais atenção."],
];
