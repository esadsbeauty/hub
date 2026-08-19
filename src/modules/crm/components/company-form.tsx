import { zodResolver } from "@hookform/resolvers/zod";
import { type SubmitHandler, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { companySchema, type CompanyFormData } from "../schema";
import type { Company } from "../types";
import { normalizeInstagram, normalizeWhatsapp } from "../utils/contact-normalizers";

const defaultValues: CompanyFormData = {
  fantasyName: "",
  legalName: "",
  cnpj: "",
  phone: "",
  whatsapp: "",
  instagram: "",
  facebook: "",
  website: "",
  email: "",
  zipCode: "",
  address: "",
  number: "",
  complement: "",
  district: "",
  city: "",
  state: "",
  responsibleName: "",
  responsibleRole: "",
  employees: undefined,
  businessArea: "",
  leadSource: "",
  owner: "Administrador",
  temperature: "morno",
  priority: "media",
  notes: "",
  tags: "",
};

function toFormValues(company?: Company): CompanyFormData {
  if (!company) return defaultValues;
  return {
    ...defaultValues,
    ...company,
    employees: company.employees,
    tags: company.tags.join(", "),
  };
}

export function CompanyForm({
  company,
  onSubmit,
  onCancel,
}: {
  company?: Company;
  onSubmit: SubmitHandler<CompanyFormData>;
  onCancel: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CompanyFormData>({
    resolver: zodResolver(companySchema),
    defaultValues: toFormValues(company),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 sm:space-y-5"><p className="text-[15px] leading-6 sm:text-sm text-muted-foreground md:hidden">Cadastre o essencial agora. Você poderá completar os dados depois.</p>
      <div className="grid gap-4 sm:grid-cols-2 sm:gap-3">
        <Input aria-label="Nome da empresa" placeholder="Nome da empresa" {...register("fantasyName")} />
        <Input aria-label="Contato" placeholder="Contato" {...register("responsibleName")} />
        <Input aria-label="WhatsApp" type="tel" inputMode="tel" autoComplete="tel" placeholder="WhatsApp" {...register("whatsapp", { setValueAs: normalizeWhatsapp })} />
        <Input aria-label="Instagram" autoCapitalize="none" autoComplete="off" placeholder="Instagram" {...register("instagram", { setValueAs: normalizeInstagram })} />
        <Input aria-label="Origem" placeholder="Origem" list="lead-source-options" {...register("leadSource")} />
        <datalist id="lead-source-options"><option value="Instagram"/><option value="Meta Ads"/><option value="Google"/><option value="Indicação"/><option value="Prospecção"/><option value="Outro"/></datalist>
      </div>
      <details className="rounded-xl border border-border/70 p-4"><summary className="cursor-pointer text-base font-semibold sm:text-sm">Adicionar mais informações</summary><div className="mt-5 grid gap-4 sm:mt-4 sm:grid-cols-2 sm:gap-3 md:grid-cols-3">
        <Input placeholder="Razão social" {...register("legalName")} /><Input placeholder="CNPJ" {...register("cnpj")} /><Input type="tel" placeholder="Telefone" {...register("phone")} />
        <Input placeholder="Facebook" {...register("facebook")} /><Input type="url" placeholder="Site" {...register("website")} /><Input type="email" autoComplete="email" placeholder="Email" {...register("email")} />
        <Input inputMode="numeric" placeholder="CEP" {...register("zipCode")} /><Input placeholder="Endereço" {...register("address")} /><Input placeholder="Número" {...register("number")} />
        <Input placeholder="Complemento" {...register("complement")} /><Input placeholder="Bairro" {...register("district")} /><Input placeholder="Cidade" {...register("city")} /><Input placeholder="Estado" {...register("state")} />
        <Input placeholder="Cargo do contato" {...register("responsibleRole")} /><Input type="number" inputMode="numeric" placeholder="Funcionários" {...register("employees", { setValueAs: (value: string) => value === "" ? undefined : Number(value) })} />
        <Input placeholder="Área de atuação" {...register("businessArea")} /><Input placeholder="Responsável interno" {...register("owner")} /><Input placeholder="Tags separadas por vírgula" {...register("tags")} />
        <Select aria-label="Temperatura" {...register("temperature")}><option value="frio">Frio</option><option value="morno">Morno</option><option value="quente">Quente</option></Select>
        <Select aria-label="Prioridade" {...register("priority")}><option value="baixa">Baixa</option><option value="media">Média</option><option value="alta">Alta</option></Select>
      </div></details>
      <Textarea placeholder="Observações" {...register("notes")} />
      {errors.fantasyName && (
        <p className="text-sm text-red-600">{errors.fantasyName.message}</p>
      )}
      {errors.employees && (
        <p className="text-sm text-red-600">{errors.employees.message}</p>
      )}
      <div className="sticky bottom-0 flex justify-end gap-2 border-t border-border/60 bg-card py-3 sm:static sm:border-0 sm:py-0">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button disabled={isSubmitting}>
          {company ? "Salvar empresa" : "Cadastrar empresa"}
        </Button>
      </div>
    </form>
  );
}
