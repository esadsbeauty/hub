import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo } from "react";
import { type SubmitHandler, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { taskSchema, type TaskFormData } from "../schema";
import type { Company, Opportunity, Profile, Task, TaskType } from "../types";
import { localDateKey } from "../utils/formatters";

const typeLabels: { value: TaskType; label: string }[] = [
  { value: "follow_up", label: "Follow-up" },
  { value: "call", label: "Ligação" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "meeting", label: "Reunião" },
  { value: "task", label: "Tarefa" },
];

function dateAfter(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

export function TaskForm({
  task,
  initialDate,
  initialType,
  companyId,
  opportunityId,
  companies,
  opportunities,
  profiles,
  onSubmit,
  onCancel,
}: {
  task?: Task;
  initialDate?: string;
  initialType?: TaskType;
  companyId?: string;
  opportunityId?: string;
  companies: Company[];
  opportunities: Opportunity[];
  profiles: Profile[];
  onSubmit: SubmitHandler<TaskFormData>;
  onCancel: () => void;
}) {
  const taskDate = task ? new Date(task.dueAt) : undefined;
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      companyId: task?.companyId ?? companyId ?? "",
      opportunityId: task?.opportunityId ?? opportunityId ?? "",
      title: task?.title ?? "",
      description: task?.description ?? "",
      type: task?.type ?? initialType ?? "follow_up",
      priority: task?.priority ?? "medium",
      assignedTo: task?.assignedTo ?? profiles[0]?.id ?? "",
      date: taskDate
        ? localDateKey(taskDate)
        : (initialDate ?? localDateKey(new Date())),
      time: taskDate ? taskDate.toTimeString().slice(0, 5) : "09:00",
      durationMinutes: task?.durationMinutes ?? 30,
      locationType: task?.locationType ?? "online",
      location: task?.location ?? "",
      meetingUrl: task?.meetingUrl ?? "",
    },
  });
  const selectedCompany = watch("companyId");
  const selectedType = watch("type");
  const availableOpportunities = useMemo(
    () =>
      opportunities.filter(
        (item) => item.companyId === selectedCompany && item.status === "open",
      ),
    [opportunities, selectedCompany],
  );
  const shortcuts = [
    { label: "Hoje", date: dateAfter(0) },
    { label: "Amanhã", date: dateAfter(1) },
    { label: "Em 2 dias", date: dateAfter(2) },
    { label: "Próxima semana", date: dateAfter(7) },
  ];

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <div className="flex flex-wrap gap-2">
        {shortcuts.map((item) => (
          <Button
            key={item.label}
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setValue("date", item.date)}
          >
            {item.label}
          </Button>
        ))}
      </div>
      <div className="grid gap-5 md:grid-cols-2 md:gap-3">
        <Select {...register("type")}>
          {typeLabels.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </Select>
        <Input placeholder="Título" {...register("title")} />
        <Select
          {...register("companyId")}
          onChange={(event) => {
            setValue("companyId", event.target.value);
            setValue("opportunityId", "");
          }}
        >
          <option value="">Sem empresa vinculada</option>
          {companies.map((item) => (
            <option key={item.id} value={item.id}>
              {item.fantasyName}
            </option>
          ))}
        </Select>
        <Select {...register("opportunityId")} disabled={!selectedCompany}>
          <option value="">Sem oportunidade vinculada</option>
          {availableOpportunities.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </Select>
        <Select {...register("assignedTo")}>
          <option value="">Selecione o responsável</option>
          {profiles.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </Select>
        <Select {...register("priority")}>
          <option value="low">Baixa</option>
          <option value="medium">Média</option>
          <option value="high">Alta</option>
          <option value="urgent">Urgente</option>
        </Select>
        <Input type="date" {...register("date")} />
        <Input type="time" {...register("time")} />
        {selectedType === "meeting" && (
          <>
            <Select {...register("locationType")}>
              <option value="online">Online</option>
              <option value="in_person">Presencial</option>
              <option value="phone">Telefone</option>
              <option value="other">Outro</option>
            </Select>
            <Select {...register("durationMinutes", { valueAsNumber: true })}>
              <option value="15">15 minutos</option>
              <option value="30">30 minutos</option>
              <option value="45">45 minutos</option>
              <option value="60">60 minutos</option>
            </Select>
            <Input placeholder="Local" {...register("location")} />
            <Input placeholder="Link da reunião" {...register("meetingUrl")} />
          </>
        )}
        <Textarea
          className="md:col-span-2"
          placeholder="Descrição"
          {...register("description")}
        />
      </div>
      <div className="space-y-1 text-sm text-red-600">
        {errors.title && <p>{errors.title.message}</p>}
        {errors.assignedTo && <p>{errors.assignedTo.message}</p>}
        {errors.meetingUrl && <p>{errors.meetingUrl.message}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3 md:flex md:justify-end md:gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button disabled={isSubmitting}>
          {task ? "Salvar alterações" : "Criar atividade"}
        </Button>
      </div>
    </form>
  );
}
