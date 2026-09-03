export type BusinessMode = "b2c" | "b2b";

export const crmTerminology = (mode: BusinessMode) => mode === "b2c" ? {
  company: "Lead", companies: "Leads", newCompany: "Novo Lead", editCompany: "Editar Lead",
  companyData: "Dados do Lead", contact: "Pessoa", missingContact: "Contato não informado",
} : {
  company: "Empresa", companies: "Empresas", newCompany: "Nova empresa", editCompany: "Editar empresa",
  companyData: "Dados da empresa", contact: "Contato", missingContact: "Sem contato principal",
};
