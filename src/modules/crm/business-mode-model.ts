export type BusinessMode = "b2c" | "b2b" | "b2c_beauty";

export const isB2CMode = (mode: BusinessMode) =>
  mode === "b2c" || mode === "b2c_beauty";

export const isBeautyMode = (mode: BusinessMode) =>
  mode === "b2c_beauty";

export const crmTerminology = (mode: BusinessMode) =>
  isB2CMode(mode)
    ? {
        company: "Lead",
        companies: "Leads",
        newCompany: "Novo Lead",
        editCompany: "Editar Lead",
        companyData: "Dados do Lead",
        contact: "Pessoa",
        missingContact: "Contato não informado",
      }
    : {
        company: "Empresa",
        companies: "Empresas",
        newCompany: "Nova empresa",
        editCompany: "Editar empresa",
        companyData: "Dados da empresa",
        contact: "Contato",
        missingContact: "Sem contato principal",
      };