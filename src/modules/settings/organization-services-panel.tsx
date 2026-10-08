import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Save, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/shared/components/feedback/toast";
import { useAppState } from "@/shared/state/app-state-context";

type OrganizationService = {
  id: string;
  organization_id: string;
  name: string;
  default_price: number | null;
  is_active: boolean;
  position: number;
  created_at: string;
  updated_at: string;
};

type ServiceDraft = {
  name: string;
  defaultPrice: string;
};

const servicesKey = (organizationId: string) =>
  ["organization", organizationId, "services"] as const;

function parsePrice(value: string) {
  const normalized = value
    .trim()
    .replace(/\./g, "")
    .replace(",", ".");

  if (!normalized) return null;

  const price = Number(normalized);

  if (!Number.isFinite(price) || price < 0) {
    throw new Error("Informe um valor válido.");
  }

  return price;
}

function priceInputValue(value: number | null) {
  if (value === null) return "";
  return value.toFixed(2).replace(".", ",");
}

export function OrganizationServicesPanel({
  editable,
}: {
  editable: boolean;
}) {
  const { organizationId } = useAppState();
  const { notify } = useToast();
  const queryClient = useQueryClient();

  const [newService, setNewService] = useState<ServiceDraft>({
    name: "",
    defaultPrice: "",
  });

  const [editing, setEditing] = useState<Record<string, ServiceDraft>>({});

  const servicesQuery = useQuery({
    queryKey: servicesKey(organizationId),
    enabled: Boolean(organizationId && supabase),
    queryFn: async () => {
      if (!supabase) return [] as OrganizationService[];

      const result = await supabase
        .from("organization_services")
        .select(
          "id,organization_id,name,default_price,is_active,position,created_at,updated_at",
        )
        .eq("organization_id", organizationId)
        .order("position", { ascending: true })
        .order("name", { ascending: true });

      if (result.error) {
        throw new Error("Não foi possível carregar os serviços.");
      }

      return (result.data ?? []) as OrganizationService[];
    },
  });

  const services = servicesQuery.data ?? [];

  const activeCount = useMemo(
    () => services.filter((service) => service.is_active).length,
    [services],
  );

  const invalidate = async () => {
    await queryClient.invalidateQueries({
      queryKey: servicesKey(organizationId),
    });
    await servicesQuery.refetch();
  };

  const createService = useMutation({
    mutationFn: async () => {
      if (!supabase) throw new Error("Supabase não configurado.");

      const name = newService.name.trim();
      if (!name) throw new Error("Informe o nome do serviço.");

      const defaultPrice = parsePrice(newService.defaultPrice);

      const result = await supabase
        .from("organization_services")
        .insert({
          organization_id: organizationId,
          name,
          default_price: defaultPrice,
          is_active: true,
          position: services.length,
          updated_at: new Date().toISOString(),
        })
        .select(
          "id,organization_id,name,default_price,is_active,position,created_at,updated_at",
        )
        .single();

      if (result.error) {
        if (result.error.code === "23505") {
          throw new Error("Já existe um serviço com esse nome.");
        }

        throw new Error(
          result.error.message || "Não foi possível adicionar o serviço.",
        );
      }

      return result.data as OrganizationService;
    },
    onSuccess: async (createdService) => {
      queryClient.setQueryData<OrganizationService[]>(
        servicesKey(organizationId),
        (current = []) => [...current, createdService],
      );

      setNewService({
        name: "",
        defaultPrice: "",
      });

      await invalidate();

      notify({
        title: "Serviço adicionado.",
      });
    },
    onError: (error) =>
      notify({
        title:
          error instanceof Error
            ? error.message
            : "Não foi possível adicionar.",
      }),
  });

  const updateService = useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: Partial<
        Pick<OrganizationService, "name" | "default_price" | "is_active">
      >;
    }) => {
      if (!supabase) throw new Error("Supabase não configurado.");

      const result = await supabase
        .from("organization_services")
        .update({
          ...input,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("organization_id", organizationId)
        .select(
          "id,organization_id,name,default_price,is_active,position,created_at,updated_at",
        )
        .single();

      if (result.error) {
        if (result.error.code === "23505") {
          throw new Error("Já existe um serviço com esse nome.");
        }

        throw new Error(
          result.error.message || "Não foi possível atualizar o serviço.",
        );
      }

      return result.data as OrganizationService;
    },
    onSuccess: async (updatedService, variables) => {
      queryClient.setQueryData<OrganizationService[]>(
        servicesKey(organizationId),
        (current = []) =>
          current.map((service) =>
            service.id === updatedService.id ? updatedService : service,
          ),
      );

      setEditing((current) => {
        const next = { ...current };
        delete next[variables.id];
        return next;
      });

      await invalidate();

      notify({
        title: "Serviço atualizado.",
      });
    },
    onError: (error) =>
      notify({
        title:
          error instanceof Error
            ? error.message
            : "Não foi possível atualizar.",
      }),
  });

  const saveService = (service: OrganizationService) => {
    const draft = editing[service.id];
    if (!draft) return;

    const name = draft.name.trim();

    if (!name) {
      notify({
        title: "Informe o nome do serviço.",
      });
      return;
    }

    let defaultPrice: number | null;

    try {
      defaultPrice = parsePrice(draft.defaultPrice);
    } catch (error) {
      notify({
        title: error instanceof Error ? error.message : "Valor inválido.",
      });
      return;
    }

    updateService.mutate({
      id: service.id,
      input: {
        name,
        default_price: defaultPrice,
      },
    });
  };

  const beginEdit = (service: OrganizationService) => {
    setEditing((current) => ({
      ...current,
      [service.id]: {
        name: service.name,
        defaultPrice: priceInputValue(service.default_price),
      },
    }));
  };

  if (servicesQuery.isLoading) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Carregando serviços…
        </CardContent>
      </Card>
    );
  }

  if (servicesQuery.isError) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="font-semibold">
            Não foi possível carregar os serviços.
          </p>

          <Button
            className="mt-4"
            variant="outline"
            onClick={() => void servicesQuery.refetch()}
          >
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Serviços</h2>

        <p className="mt-1 text-sm text-muted-foreground">
          Configure os procedimentos e serviços oferecidos por esta organização.
          Essa lista poderá ser usada nos orçamentos e oportunidades do CRM.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <span className="text-sm text-muted-foreground">
              Serviços cadastrados
            </span>

            <b className="mt-2 block text-3xl">{services.length}</b>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <span className="text-sm text-muted-foreground">
              Serviços ativos
            </span>

            <b className="mt-2 block text-3xl">{activeCount}</b>
          </CardContent>
        </Card>
      </div>

      {editable && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus size={18} />
              Adicionar serviço
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_14rem_auto] md:items-end">
              <div className="space-y-2">
                <Label htmlFor="new-service-name">
                  Nome do serviço
                </Label>

                <Input
                  id="new-service-name"
                  value={newService.name}
                  placeholder="Ex.: Botox"
                  onChange={(event) =>
                    setNewService((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-service-price">
                  Valor padrão (opcional)
                </Label>

                <Input
                  id="new-service-price"
                  inputMode="decimal"
                  value={newService.defaultPrice}
                  placeholder="Ex.: 950,00"
                  onChange={(event) =>
                    setNewService((current) => ({
                      ...current,
                      defaultPrice: event.target.value,
                    }))
                  }
                />
              </div>

              <Button
                disabled={
                  createService.isPending ||
                  !newService.name.trim()
                }
                onClick={() => createService.mutate()}
              >
                <Plus size={16} />

                {createService.isPending
                  ? "Adicionando…"
                  : "Adicionar"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 size={18} />
            Catálogo da organização
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          {services.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum serviço cadastrado.
            </p>
          ) : (
            services.map((service) => {
              const draft = editing[service.id];
              const isEditing = Boolean(draft);

              return (
                <article
                  key={service.id}
                  className="grid gap-3 rounded-2xl border bg-background p-4 md:grid-cols-[minmax(0,1fr)_12rem_auto] md:items-center"
                >
                  <div>
                    {isEditing ? (
                      <Input
                        aria-label={`Nome de ${service.name}`}
                        value={draft.name}
                        onChange={(event) =>
                          setEditing((current) => ({
                            ...current,
                            [service.id]: {
                              ...current[service.id],
                              name: event.target.value,
                            },
                          }))
                        }
                      />
                    ) : (
                      <>
                        <b
                          className={
                            service.is_active
                              ? ""
                              : "text-muted-foreground line-through"
                          }
                        >
                          {service.name}
                        </b>

                        <p className="mt-1 text-xs text-muted-foreground">
                          {service.is_active
                            ? "Ativo"
                            : "Inativo"}
                        </p>
                      </>
                    )}
                  </div>

                  <div>
                    {isEditing ? (
                      <Input
                        aria-label={`Valor padrão de ${service.name}`}
                        inputMode="decimal"
                        value={draft.defaultPrice}
                        placeholder="Valor padrão"
                        onChange={(event) =>
                          setEditing((current) => ({
                            ...current,
                            [service.id]: {
                              ...current[service.id],
                              defaultPrice:
                                event.target.value,
                            },
                          }))
                        }
                      />
                    ) : (
                      <span className="text-sm">
                        {service.default_price === null
                          ? "Sem valor padrão"
                          : service.default_price.toLocaleString(
                              "pt-BR",
                              {
                                style: "currency",
                                currency: "BRL",
                              },
                            )}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 md:justify-end">
                    {editable && isEditing ? (
                      <>
                        <Button
                          size="sm"
                          disabled={updateService.isPending}
                          onClick={() => saveService(service)}
                        >
                          <Save size={15} />
                          Salvar
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setEditing((current) => {
                              const next = {
                                ...current,
                              };

                              delete next[service.id];

                              return next;
                            })
                          }
                        >
                          Cancelar
                        </Button>
                      </>
                    ) : editable ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            beginEdit(service)
                          }
                        >
                          Editar
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          disabled={updateService.isPending}
                          onClick={() =>
                            updateService.mutate({
                              id: service.id,
                              input: {
                                is_active:
                                  !service.is_active,
                              },
                            })
                          }
                        >
                          {service.is_active
                            ? "Desativar"
                            : "Ativar"}
                        </Button>
                      </>
                    ) : null}
                  </div>
                </article>
              );
            })
          )}
        </CardContent>
      </Card>
    </section>
  );
}
