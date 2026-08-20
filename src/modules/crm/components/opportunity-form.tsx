import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { type SubmitHandler, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { opportunitySchema, type OpportunityFormData } from "../schema";
import type { Company, Opportunity, Pipeline, PipelineStage } from "../types";

export function OpportunityForm({
  companyId,
  opportunity,
  companies,
  pipelines,
  stages,
  onSubmit,
  onCancel,
}: {
  companyId?: string;
  opportunity?: Opportunity;
  companies: Company[];
  pipelines: Pipeline[];
  stages: PipelineStage[];
  onSubmit: SubmitHandler<OpportunityFormData>;
  onCancel: () => void;
}) {
  const defaultPipeline =
    pipelines.find((item) => item.isDefault) ?? pipelines[0];
  const availableStages = stages
    .filter(
      (item) =>
        item.pipelineId === (opportunity?.pipelineId ?? defaultPipeline?.id),
    )
    .sort((a, b) => a.position - b.position);
  const defaultStage = availableStages[0];
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<OpportunityFormData>({
    resolver: zodResolver(opportunitySchema),
    defaultValues: opportunity
      ? {
          companyId: opportunity.companyId,
          pipelineId: opportunity.pipelineId,
          stageId: opportunity.stageId,
          title: opportunity.title,
          description: opportunity.description ?? "",
          value: opportunity.value,
          probability: opportunity.probability,
          expectedCloseDate: opportunity.expectedCloseDate ?? "",
          owner: opportunity.owner ?? "",
          source: opportunity.source ?? "",
        }
      : {
          companyId: companyId ?? "",
          pipelineId: defaultPipeline?.id ?? "",
          stageId: defaultStage?.id ?? "",
          title: "",
          description: "",
          value: 0,
          probability: defaultStage?.probability ?? 0,
          expectedCloseDate: "",
          owner: "Administrador",
          source: "",
        },
  });
  const pipelineId = watch("pipelineId");
  const stageId = watch("stageId");
  const pipelineStages = stages
    .filter((item) => item.pipelineId === pipelineId)
    .sort((a, b) => a.position - b.position);
  useEffect(() => {
    const stage = stages.find((item) => item.id === stageId);
    if (stage) setValue("probability", stage.probability);
  }, [stageId, stages, setValue]);
  return (
    <form
      className="grid gap-5 md:grid-cols-2 md:gap-3"
      onSubmit={handleSubmit(onSubmit)}
    >
      <Select disabled={Boolean(companyId)} {...register("companyId")}>
        <option value="">Selecione a empresa</option>
        {companies.map((item) => (
          <option key={item.id} value={item.id}>
            {item.fantasyName}
          </option>
        ))}
      </Select>
      <Input placeholder="Título da oportunidade" {...register("title")} />
      <Select
        {...register("pipelineId")}
        onChange={(event) => {
          setValue("pipelineId", event.target.value);
          const first = stages
            .filter((item) => item.pipelineId === event.target.value)
            .sort((a, b) => a.position - b.position)[0];
          if (first) setValue("stageId", first.id);
        }}
      >
        {pipelines.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </Select>
      <Select {...register("stageId")}>
        {pipelineStages.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </Select>
      <Input
        type="number"
        min="0"
        step="0.01"
        placeholder="Valor"
        {...register("value", { valueAsNumber: true })}
      />
      <Input
        type="number"
        min="0"
        max="100"
        placeholder="Probabilidade (%)"
        {...register("probability", { valueAsNumber: true })}
      />
      <Input placeholder="Responsável" {...register("owner")} />
      <Input placeholder="Origem" {...register("source")} />
      <Input type="date" {...register("expectedCloseDate")} />
      <Textarea
        className="md:col-span-2"
        placeholder="Descrição"
        {...register("description")}
      />
      <div className="md:col-span-2 space-y-1 text-sm text-red-600">
        {errors.title && <p>{errors.title.message}</p>}
        {errors.value && <p>{errors.value.message}</p>}
        {errors.probability && <p>{errors.probability.message}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3 md:flex md:justify-end md:gap-2 md:col-span-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button disabled={isSubmitting}>
          {opportunity ? "Salvar oportunidade" : "Criar oportunidade"}
        </Button>
      </div>
    </form>
  );
}
