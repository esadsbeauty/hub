import { zodResolver } from '@hookform/resolvers/zod';
import { type SubmitHandler, useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { companySchema, type CompanyFormData } from '../schema';
import type { Company } from '../types';

const defaultValues: CompanyFormData = {
  fantasyName: '', legalName: '', cnpj: '', phone: '', whatsapp: '', instagram: '', facebook: '', website: '', email: '', zipCode: '', address: '', number: '', complement: '', district: '', city: '', state: '', responsibleName: '', responsibleRole: '', employees: undefined, businessArea: '', leadSource: '', owner: 'Administrador', temperature: 'morno', priority: 'media', notes: '', tags: '',
};

function toFormValues(company?: Company): CompanyFormData {
  if (!company) return defaultValues;
  return { ...defaultValues, ...company, employees: company.employees, tags: company.tags.join(', ') };
}

export function CompanyForm({ company, onSubmit, onCancel }: { company?: Company; onSubmit: SubmitHandler<CompanyFormData>; onCancel: () => void }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CompanyFormData>({
    resolver: zodResolver(companySchema),
    defaultValues: toFormValues(company),
  });

  return <form onSubmit={handleSubmit(onSubmit)} className="space-y-5"><div className="grid gap-3 md:grid-cols-3"><Input placeholder="Nome fantasia" {...register('fantasyName')} /><Input placeholder="Razão social" {...register('legalName')} /><Input placeholder="CNPJ" {...register('cnpj')} /><Input placeholder="Telefone" {...register('phone')} /><Input placeholder="WhatsApp" {...register('whatsapp')} /><Input placeholder="Instagram" {...register('instagram')} /><Input placeholder="Facebook" {...register('facebook')} /><Input placeholder="Site" {...register('website')} /><Input placeholder="Email" {...register('email')} /><Input placeholder="CEP" {...register('zipCode')} /><Input placeholder="Endereço" {...register('address')} /><Input placeholder="Número" {...register('number')} /><Input placeholder="Complemento" {...register('complement')} /><Input placeholder="Bairro" {...register('district')} /><Input placeholder="Cidade" {...register('city')} /><Input placeholder="Estado" {...register('state')} /><Input placeholder="Responsável" {...register('responsibleName')} /><Input placeholder="Cargo" {...register('responsibleRole')} /><Input type="number" placeholder="Funcionários" {...register('employees', { setValueAs: (value: string) => value === '' ? undefined : Number(value) })} /><Input placeholder="Área de atuação" {...register('businessArea')} /><Input placeholder="Origem" {...register('leadSource')} /><Input placeholder="Responsável interno" {...register('owner')} /><Input placeholder="Tags separadas por vírgula" {...register('tags')} /><Select {...register('temperature')}><option value="frio">Frio</option><option value="morno">Morno</option><option value="quente">Quente</option></Select><Select {...register('priority')}><option value="baixa">Baixa</option><option value="media">Média</option><option value="alta">Alta</option></Select></div><Textarea placeholder="Observações" {...register('notes')} />{errors.fantasyName && <p className="text-sm text-red-600">{errors.fantasyName.message}</p>}{errors.employees && <p className="text-sm text-red-600">{errors.employees.message}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button><Button disabled={isSubmitting}>{company ? 'Salvar empresa' : 'Cadastrar empresa'}</Button></div></form>;
}
