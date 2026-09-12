import { isLocalMode } from "@/config/app-mode";
import { supabase } from "@/lib/supabase";
import type {
  PlatformCharge,
  PlatformSnapshot,
  ProvisionOrganizationInput,
} from "./types";

const modules = [
  "dashboard",
  "crm",
  "agenda",
  "customers",
  "finance",
  "marketing",
  "reports",
  "settings",
  "users",
  "roles",
  "audit",
  "blog",
];

const local: PlatformSnapshot = {
  metrics: {
    activeCustomers: 0,
    mrrCents: 0,
    pastDue: 0,
    suspended: 0,
  },
  plans: [
    {
      id: "founders",
      name: "Fundadores",
      slug: "fundadores",
      priceCents: 4990,
      billingMode: "manual",
      isActive: true,
      entitlements: modules,
    },
  ],
  organizations: [
    {
      id: "local-esads-beauty",
      name: "ESADS Beauty",
      planId: "founders",
      planName: "Fundadores",
      status: "active",
    },
  ],
};

type FunctionErrorPayload = {
  message?: string;
};

type JsonResponseLike = {
  json: () => Promise<unknown>;
};

function hasJsonMethod(value: unknown): value is JsonResponseLike {
  return (
    typeof value === "object" &&
    value !== null &&
    "json" in value &&
    typeof (value as JsonResponseLike).json === "function"
  );
}

function messageFromUnknown(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null) return undefined;

  const message = (value as FunctionErrorPayload).message;

  return typeof message === "string" && message.trim()
    ? message
    : undefined;
}

async function getFunctionErrorMessage(
  error: unknown,
): Promise<string | undefined> {
  if (typeof error !== "object" || error === null) return undefined;

  const context =
    "context" in error
      ? (error as { context?: unknown }).context
      : undefined;

  if (hasJsonMethod(context)) {
    try {
      return messageFromUnknown(await context.json());
    } catch {
      // Algumas versões do supabase-js usam outros formatos de erro.
    }
  }

  const contextMessage = messageFromUnknown(context);
  if (contextMessage) return contextMessage;

  const errorMessage = messageFromUnknown(error);
  if (errorMessage) return errorMessage;

  return undefined;
}

function client() {
  if (!supabase) {
    throw new Error("Não foi possível conectar à plataforma.");
  }

  return supabase;
}

function fail(
  error: { message: string } | null,
  message: string,
) {
  if (error) {
    throw new Error(message);
  }
}

export const platformRepository = {
  async snapshot(): Promise<PlatformSnapshot> {
    if (isLocalMode) return local;

    if (!supabase) {
      throw new Error("Não foi possível conectar à plataforma.");
    }

    const result = await supabase.rpc("platform_admin_snapshot");

    if (result.error) {
      throw new Error(
        "Não foi possível carregar os planos da plataforma.",
      );
    }

    return result.data as unknown as PlatformSnapshot;
  },

  async provision(
    input: ProvisionOrganizationInput,
  ): Promise<{ message: string }> {
    if (isLocalMode) {
      throw new Error(
        "O provisionamento exige o ambiente Supabase.",
      );
    }

    if (!supabase) {
      throw new Error("Não foi possível conectar à plataforma.");
    }

    const result = await supabase.functions.invoke(
      "provision-organization",
      {
        body: input,
      },
    );

    if (result.error) {
      const message = await getFunctionErrorMessage(result.error);

      throw new Error(
        message ?? "Não foi possível criar a organização.",
      );
    }

    return result.data as { message: string };
  },

  async generateCharge(subscriptionId: string) {
    const result = await client().functions.invoke(
      "create-billing-charge",
      {
        body: {
          subscriptionId,
          action: "create",
        },
      },
    );

    if (result.error) {
      throw new Error("Não foi possível gerar a cobrança Pix.");
    }

    return result.data as { message: string };
  },

  async syncCharge(subscriptionId: string) {
    const result = await client().functions.invoke(
      "create-billing-charge",
      {
        body: {
          subscriptionId,
          action: "sync",
        },
      },
    );

    if (result.error) {
      throw new Error("Não foi possível sincronizar a cobrança.");
    }

    return result.data as { message: string };
  },

  async charge(
    subscriptionId: string,
  ): Promise<PlatformCharge | undefined> {
    if (isLocalMode) return undefined;

    const result = await client().rpc(
      "platform_billing_charge_snapshot",
      {
        target_subscription_id: subscriptionId,
      },
    );

    fail(result.error, "Não foi possível carregar a cobrança.");

    if (!result.data) return undefined;

    const charge = result.data as Record<string, unknown>;

    return {
      id: String(charge.id),
      provider: String(charge.provider),
      externalPaymentId: charge.external_payment_id
        ? String(charge.external_payment_id)
        : undefined,
      status: String(charge.status),
      amountCents: Number(charge.amount_cents),
      currency: String(charge.currency),
      dueAt: String(charge.due_at),
      paymentMethod: String(charge.payment_method),
      invoiceUrl: charge.invoice_url
        ? String(charge.invoice_url)
        : undefined,
      errorMessage: charge.error_message
        ? String(charge.error_message)
        : undefined,
    };
  },

  async markPaid(subscriptionId: string, notes?: string) {
    const result = await client().rpc(
      "platform_mark_subscription_paid",
      {
        target_subscription_id: subscriptionId,
        payment_notes: notes ?? null,
      },
    );

    fail(result.error, "Não foi possível registrar o pagamento.");
  },

  async changeDueDate(
    subscriptionId: string,
    dueAt: string,
  ) {
    const result = await client().rpc(
      "platform_change_subscription_due_date",
      {
        target_subscription_id: subscriptionId,
        new_due_at: dueAt,
      },
    );

    fail(result.error, "Não foi possível alterar o vencimento.");
  },

  async suspend(subscriptionId: string) {
    const result = await client().rpc(
      "platform_suspend_subscription",
      {
        target_subscription_id: subscriptionId,
      },
    );

    fail(result.error, "Não foi possível suspender a assinatura.");
  },

  async reactivate(subscriptionId: string) {
    const result = await client().rpc(
      "platform_reactivate_subscription",
      {
        target_subscription_id: subscriptionId,
      },
    );

    fail(result.error, "Não foi possível reativar a assinatura.");
  },

  async cancel(subscriptionId: string) {
    const result = await client().rpc(
      "platform_cancel_subscription",
      {
        target_subscription_id: subscriptionId,
      },
    );

    fail(result.error, "Não foi possível cancelar a assinatura.");
  },

  async assignPlan(
    organizationId: string,
    planId: string,
  ) {
    if (isLocalMode) return;

    if (!supabase) {
      throw new Error("Não foi possível conectar à plataforma.");
    }

    const result = await supabase.rpc(
      "platform_assign_organization_plan",
      {
        target_organization_id: organizationId,
        target_plan_id: planId,
      },
    );

    if (result.error) {
      throw new Error(
        "Não foi possível alterar o plano da organização.",
      );
    }
  },
};
