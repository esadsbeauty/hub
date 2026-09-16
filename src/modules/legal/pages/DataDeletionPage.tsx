import { generalContactEmail } from "@/config/contact";
import { LegalDocument, type LegalSection } from "../components/legal-document";

const sections: LegalSection[] = [
  {
    title: "Como solicitar a exclusão",
    content: (
      <>
        <p>
          Você pode solicitar a exclusão dos seus dados pessoais relacionados ao
          ESADS Beauty entrando em contato pelo e-mail{" "}
          <a href={`mailto:${generalContactEmail}`}>{generalContactEmail}</a>.
        </p>
        <p>
          No assunto da mensagem, informe <strong>Solicitação de exclusão de dados</strong>.
          Para localizar corretamente sua conta, informe o e-mail utilizado no cadastro e,
          se aplicável, o nome da empresa ou organização vinculada ao ESADS Beauty.
        </p>
      </>
    ),
  },
  {
    title: "Validação da solicitação",
    content: (
      <p>
        Para proteger os dados contra exclusões indevidas, poderemos solicitar informações
        adicionais para confirmar a identidade do solicitante e sua relação com a conta
        ou organização.
      </p>
    ),
  },
  {
    title: "O que pode ser excluído",
    content: (
      <>
        <p>
          Quando aplicável, a solicitação poderá abranger dados de perfil, informações de
          cadastro e outros dados pessoais associados diretamente ao usuário no ESADS Beauty.
        </p>
        <p>
          Dados inseridos por uma empresa cliente sobre seus próprios leads, pacientes ou
          clientes poderão estar sob responsabilidade dessa organização e, nesse caso,
          a solicitação poderá ser direcionada ao respectivo controlador dos dados.
        </p>
      </>
    ),
  },
  {
    title: "Prazos e retenção",
    content: (
      <p>
        As solicitações serão analisadas dentro de prazo razoável e em conformidade com a
        legislação aplicável. Determinadas informações poderão ser mantidas quando houver
        obrigação legal, necessidade de prevenção a fraudes, segurança, cumprimento de
        contrato ou exercício regular de direitos.
      </p>
    ),
  },
  {
    title: "Dados relacionados à Meta e ao WhatsApp",
    content: (
      <p>
        Caso a solicitação envolva dados processados por integrações com a Meta ou com a
        Plataforma WhatsApp Business, o ESADS Beauty adotará as medidas cabíveis dentro das
        funcionalidades e permissões disponíveis. Algumas informações também podem permanecer
        sujeitas às políticas e aos períodos de retenção das próprias plataformas de terceiros.
      </p>
    ),
  },
  {
    title: "Contato",
    content: (
      <p>
        Para solicitar a exclusão de dados ou tirar dúvidas sobre este processo, entre em
        contato pelo e-mail{" "}
        <a href={`mailto:${generalContactEmail}`}>{generalContactEmail}</a>.
      </p>
    ),
  },
];

export function DataDeletionPage() {
  return (
    <LegalDocument
      title="Exclusão de Dados"
      eyebrow="Privacidade e controle de dados"
      description="Saiba como solicitar a exclusão de dados pessoais relacionados ao ESADS Beauty."
      path="/exclusao-de-dados"
      sections={sections}
      relatedLink={{
        to: "/politica-de-privacidade",
        label: "Consulte também nossa Política de Privacidade",
      }}
    />
  );
}
