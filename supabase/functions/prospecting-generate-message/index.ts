import { createClient } from "npm:@supabase/supabase-js@2";

type Payload = {
  lead_id?: string;
  organization_id?: string;
};

type LeadRow = {
  id: string;
  organization_id: string;
  name: string | null;
  whatsapp: string | null;
  instagram: string | null;
  city: string | null;
  business_type: string | null;
  notes: string | null;
};

const jsonResponse = (
  status: number,
  body: Record<string, unknown>,
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type":
        "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
    },
  });

function extractOutputText(
  response: unknown,
): string | null {
  const data = response as {
    output?: Array<{
      type?: string;
      content?: Array<{
        type?: string;
        text?: string;
      }>;
    }>;
  };

  if (!Array.isArray(data.output)) {
    return null;
  }

  for (const item of data.output) {
    if (
      item?.type !== "message" ||
      !Array.isArray(item.content)
    ) {
      continue;
    }

    for (const content of item.content) {
      if (
        content?.type === "output_text" &&
        typeof content.text === "string"
      ) {
        return content.text.trim();
      }
    }
  }

  return null;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods":
          "POST, OPTIONS",
      },
    });
  }

  if (request.method !== "POST") {
    return jsonResponse(405, {
      code: "method_not_allowed",
      message: "Método não permitido.",
    });
  }

  const supabaseUrl =
    Deno.env.get("SUPABASE_URL");

  const serviceRole =
    Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY",
    );

  const openAiKey =
    Deno.env.get("OPENAI_API_KEY");

  if (
    !supabaseUrl ||
    !serviceRole ||
    !openAiKey
  ) {
    return jsonResponse(503, {
      code: "not_configured",
      message:
        "Configuração da função incompleta.",
    });
  }

  const authHeader =
    request.headers.get("Authorization");

  if (!authHeader) {
    return jsonResponse(401, {
      code: "unauthorized",
      message: "Sessão não encontrada.",
    });
  }

  const userClient = createClient(
    supabaseUrl,
    Deno.env.get(
      "SUPABASE_ANON_KEY",
    ) ?? "",
    {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    },
  );

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) {
    return jsonResponse(401, {
      code: "unauthorized",
      message: "Sessão inválida.",
    });
  }

  const payload =
    (await request
      .json()
      .catch(() => ({}))) as Payload;

  const leadId =
    payload.lead_id?.trim();

  const organizationId =
    payload.organization_id?.trim();

  if (!leadId || !organizationId) {
    return jsonResponse(400, {
      code: "invalid_input",
      message:
        "lead_id e organization_id são obrigatórios.",
    });
  }

  /*
   * Antes de usar service role, confirmamos
   * que o usuário autenticado realmente
   * tem acesso à organização atual.
   */
  const {
    data: authorization,
    error: authorizationError,
  } = await userClient.rpc(
    "current_authorization",
  );

  if (
    authorizationError ||
    !authorization
  ) {
    return jsonResponse(403, {
      code: "forbidden",
      message:
        "Não foi possível validar a organização.",
    });
  }

  const authorizationData =
    authorization as {
      organization_id?: string;
      organizationId?: string;
    };

  const currentOrganizationId =
    authorizationData.organization_id ??
    authorizationData.organizationId;

  if (
    currentOrganizationId !==
    organizationId
  ) {
    return jsonResponse(403, {
      code: "forbidden",
      message:
        "Você não possui acesso a esta organização.",
    });
  }

  const admin = createClient(
    supabaseUrl,
    serviceRole,
  );

  const {
    data: feature,
    error: featureError,
  } = await admin
    .from("organization_features")
    .select("enabled")
    .eq(
      "organization_id",
      organizationId,
    )
    .eq(
      "feature_key",
      "prospecting_agent",
    )
    .eq("enabled", true)
    .maybeSingle();

  if (
    featureError ||
    feature?.enabled !== true
  ) {
    return jsonResponse(403, {
      code: "feature_disabled",
      message:
        "O módulo de prospecção não está habilitado.",
    });
  }

  const {
    data: lead,
    error: leadError,
  } = await admin
    .from("prospecting_leads")
    .select(
      `
        id,
        organization_id,
        name,
        whatsapp,
        instagram,
        city,
        business_type,
        notes
      `,
    )
    .eq("id", leadId)
    .eq(
      "organization_id",
      organizationId,
    )
    .maybeSingle();

  if (leadError || !lead) {
    return jsonResponse(404, {
      code: "lead_not_found",
      message:
        "Lead de prospecção não encontrado.",
    });
  }

  const prospect =
    lead as LeadRow;

  const instructions = `
Você é um especialista em prospecção comercial da ESADS Beauty.

Sua tarefa é criar APENAS a primeira mensagem de abordagem para iniciar uma conversa no WhatsApp.

OBJETIVO:
Gerar curiosidade e iniciar uma conversa natural. Não tente vender o serviço na primeira mensagem.

REGRAS OBRIGATÓRIAS:

1. A mensagem deve ser curta, natural e parecer escrita manualmente.
2. Não diga que é uma IA, automação ou mensagem automática.
3. Não ofereça proposta, reunião, consultoria ou tráfego pago diretamente.
4. Não invente nenhuma informação.
5. Use somente as informações realmente disponíveis sobre o lead.
6. Quando houver uma observação relevante, use-a como ponto de conexão.
7. Não exponha que a informação veio de planilha, CRM, pesquisa interna ou sistema.
8. Evite elogios exagerados e frases genéricas.
9. Evite linguagem de vendedor.
10. Se o campo Nome parecer ser o nome de uma empresa, clínica, studio, salão, consultório, espaço ou outro negócio, NÃO cumprimente como se fosse uma pessoa.
11. Para nomes de negócios, prefira aberturas naturais como:
- "Oi! Vi o perfil da [nome do negócio]..."
- "Oi, pessoal da [nome do negócio]!"
Use apenas uma dessas formas quando soar natural.
12. Se o campo Nome parecer ser o nome de uma pessoa, pode usar "Oi, [primeiro nome]!".
13. Nunca escreva construções artificiais como "Oi, pessoal Clínica X!".
14. Prefira terminar com uma pergunta simples, fácil de responder.
15. Faça no máximo uma pergunta.
16. Escreva em português do Brasil.
17. Não use markdown, listas, aspas ou explicações.
18. Retorne somente a mensagem final.
19. A mensagem deve ter preferencialmente entre 120 e 350 caracteres.

EXEMPLO DE ESTILO:
"Oi, Ana! Vi que vocês têm trabalhado bastante o Instagram da clínica. Fiquei com uma dúvida: hoje a maior parte das clientes novas chega pelo Instagram ou por indicação?"

O exemplo acima serve apenas para estilo. Não copie informações que não existam no lead.
`;

  const leadContext = `
DADOS DO LEAD:

Nome:
${prospect.name || "Não informado"}

Instagram:
${prospect.instagram || "Não informado"}

Cidade:
${prospect.city || "Não informada"}

Profissão / tipo de negócio:
${prospect.business_type || "Não informado"}

Observações:
${prospect.notes || "Nenhuma observação disponível"}

Crie a primeira mensagem de abordagem respeitando todas as regras.
`;

  let openAiResponse: Response;

  try {
    openAiResponse = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${openAiKey}`,
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          model: "gpt-5.6",
          instructions,
          input: [
            {
              role: "user",
              content: leadContext,
            },
          ],
        }),
      },
    );
  } catch (error) {
    console.error(
      "prospecting_openai_request_failed",
      error,
    );

    return jsonResponse(502, {
      code: "ai_request_failed",
      message:
        "Não foi possível gerar a mensagem.",
    });
  }

  const responsePayload =
    await openAiResponse
      .json()
      .catch(() => ({}));

  if (!openAiResponse.ok) {
    console.error(
      "prospecting_openai_error",
      {
        status:
          openAiResponse.status,
        payload: responsePayload,
      },
    );

    return jsonResponse(502, {
      code: "ai_error",
      message:
        "A IA não conseguiu gerar a mensagem.",
    });
  }

  const message =
    extractOutputText(
      responsePayload,
    );

  if (!message) {
    return jsonResponse(502, {
      code: "empty_message",
      message:
        "A IA não retornou uma mensagem válida.",
    });
  }

  const now =
    new Date().toISOString();

  const {
    error: updateError,
  } = await admin
    .from("prospecting_leads")
    .update({
      generated_message: message,
      message_edited: false,
      message_generated_at: now,
      updated_at: now,
    })
    .eq("id", leadId)
    .eq(
      "organization_id",
      organizationId,
    );

  if (updateError) {
    console.error(
      "prospecting_message_save_failed",
      updateError,
    );

    return jsonResponse(500, {
      code: "save_failed",
      message:
        "A mensagem foi gerada, mas não pôde ser salva.",
    });
  }

  return jsonResponse(200, {
    message,
  });
});