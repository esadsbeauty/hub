import { privacyContactEmail } from "@/config/contact";
import { LegalDocument, type LegalSection } from "../components/legal-document";

const sections: LegalSection[] = [
  {
    title: "Introdução",
    content: <p>A ESADS Beauty respeita a privacidade dos usuários e trata dados pessoais de forma responsável e transparente, em conformidade com a legislação aplicável, incluindo a Lei Geral de Proteção de Dados Pessoais — LGPD (Lei nº 13.709/2018).</p>,
  },
  {
    title: "Dados que podem ser coletados",
    content: <><p>Conforme a forma de utilização dos serviços, podemos tratar:</p><ul><li>nome, e-mail, telefone, WhatsApp, dados profissionais e dados da empresa;</li><li>informações de perfil, conta, autenticação e permissões;</li><li>dados de leads, pacientes, clientes e contatos cadastrados na plataforma;</li><li>informações comerciais, oportunidades, atividades e follow-ups;</li><li>dados de uso, registros técnicos, logs, endereço IP, navegador e dispositivo;</li><li>informações provenientes de integrações autorizadas, inclusive dados relacionados ao WhatsApp Business e à Meta.</li></ul><p>Os dados efetivamente tratados dependem dos recursos contratados, habilitados e utilizados.</p></>,
  },
  {
    title: "Dados inseridos pelos clientes na plataforma",
    content: <p>Os clientes podem cadastrar dados de terceiros, como leads, pacientes, clientes e contatos. A empresa ou profissional contratante é responsável por garantir uma base legal adequada para coletar, inserir e utilizar essas informações, bem como por fornecer os avisos necessários aos respectivos titulares.</p>,
  },
  {
    title: "Finalidades do tratamento",
    content: <><p>Os dados podem ser tratados para:</p><ul><li>fornecer, operar e manter a plataforma;</li><li>autenticar usuários, administrar contas e manter a segurança;</li><li>organizar o CRM, cadastrar e gerenciar leads, clientes e oportunidades;</li><li>registrar atividades comerciais, follow-ups e informações operacionais;</li><li>enviar e receber mensagens quando a funcionalidade estiver habilitada e autorizada;</li><li>prestar suporte e viabilizar integrações;</li><li>melhorar a experiência e o desempenho da plataforma;</li><li>prevenir fraudes, abusos e incidentes de segurança;</li><li>cumprir obrigações legais e exercer direitos.</li></ul></>,
  },
  {
    title: "Integração com WhatsApp Business e Meta",
    content: <><p>A ESADS Beauty pode integrar-se à Plataforma WhatsApp Business mediante autorização do usuário ou da empresa responsável pela conta. Para fornecer essa funcionalidade, podem ser processados números de telefone, identificadores técnicos, contatos, conversas, mensagens e informações relacionadas à conexão.</p><p>Esses dados são utilizados para disponibilizar recursos relacionados ao serviço, como a organização e o atendimento de conversas no CRM. Determinadas operações também estão sujeitas aos termos, políticas e regras da Meta e do WhatsApp. Quando aplicável, o usuário poderá solicitar a desconexão da integração pelos canais de suporte.</p></>,
  },
  {
    title: "Compartilhamento de dados",
    content: <><p>Quando necessário para operar os serviços, os dados podem ser compartilhados com provedores de infraestrutura, hospedagem, banco de dados, autenticação, automação, comunicação e suporte técnico, bem como com a Meta e o WhatsApp nas funcionalidades integradas.</p><p>Também poderemos compartilhar informações com autoridades públicas quando houver obrigação legal ou ordem válida. <strong>A ESADS Beauty não vende dados pessoais.</strong></p></>,
  },
  {
    title: "Segurança",
    content: <p>Adotamos medidas técnicas e administrativas razoáveis, incluindo autenticação, controles de acesso e permissões, segregação de dados por organização, registros técnicos e infraestrutura fornecida por empresas especializadas. Apesar das boas práticas adotadas, nenhum ambiente tecnológico é absolutamente imune a riscos.</p>,
  },
  {
    title: "Retenção de dados",
    content: <p>Os dados são mantidos pelo período necessário à prestação do serviço, à manutenção da conta, ao cumprimento de obrigações legais, à prevenção de fraudes e ao exercício regular de direitos. Os prazos podem variar de acordo com a natureza da informação, a finalidade do tratamento e requisitos legais ou contratuais aplicáveis.</p>,
  },
  {
    title: "Direitos do titular",
    content: <><p>Nos limites e condições da LGPD, o titular pode solicitar confirmação do tratamento, acesso, correção, anonimização, bloqueio ou exclusão quando aplicável, portabilidade quando cabível, informações sobre compartilhamento, revogação do consentimento e oposição ao tratamento nas hipóteses previstas em lei.</p><p>Algumas solicitações podem exigir validação de identidade. Quando a ESADS Beauty atuar como operadora em nome de um cliente, a solicitação poderá ser direcionada à organização responsável pelos dados.</p></>,
  },
  {
    title: "Cookies e tecnologias semelhantes",
    content: <p>Podemos utilizar cookies essenciais, armazenamento local e tecnologias semelhantes necessários para autenticação, segurança, preferências e funcionamento da plataforma. Tecnologias adicionais, quando utilizadas, serão tratadas conforme as finalidades informadas e as opções disponíveis ao usuário.</p>,
  },
  {
    title: "Serviços de terceiros",
    content: <p>Integrações e serviços externos possuem termos e políticas de privacidade próprios. Recomendamos que o usuário consulte esses documentos antes de habilitar ou utilizar uma integração.</p>,
  },
  {
    title: "Transferência e infraestrutura internacional",
    content: <p>Alguns fornecedores de infraestrutura ou serviços integrados podem processar dados fora do Brasil. Nessas situações, podem ocorrer transferências internacionais de dados, observados os requisitos e mecanismos legais aplicáveis.</p>,
  },
  {
    title: "Alterações nesta Política",
    content: <p>Esta Política poderá ser atualizada para refletir mudanças nos serviços, na legislação ou em nossas práticas. A versão vigente e sua data de atualização permanecerão disponíveis publicamente nesta página.</p>,
  },
  {
    title: "Contato",
    content: <p>Para dúvidas sobre esta Política de Privacidade ou sobre o tratamento de dados pessoais, entre em contato com a ESADS Beauty pelo e-mail <a href={`mailto:${privacyContactEmail}`}>{privacyContactEmail}</a>.</p>,
  },
];

export function PrivacyPolicyPage() {
  return <LegalDocument title="Política de Privacidade" eyebrow="Privacidade e proteção de dados" description="Entenda como a ESADS Beauty trata dados pessoais ao oferecer sua plataforma de gestão para negócios de estética e beleza." path="/politica-de-privacidade" sections={sections} relatedLink={{to:"/termos-de-uso",label:"Consulte também nossos Termos de Uso"}} />;
}
