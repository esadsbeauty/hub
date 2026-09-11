import { useEffect, useRef, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  CheckCircle2,
  Loader2,
  MessageCircleMore,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/shared/components/feedback/toast";
import { useAppState } from "@/shared/state/app-state-context";

declare global {
  interface Window {
    FB?: {
      init: (options: {
        appId: string;
        cookie?: boolean;
        xfbml?: boolean;
        version: string;
      }) => void;
      login: (
        callback: (response: {
          authResponse?: {
            code?: string;
          };
          status?: string;
        }) => void,
        options: Record<string, unknown>,
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

type Connection = {
  id: string;
  organization_id: string;
  waba_id: string | null;
  phone_number_id: string;
  display_phone_number: string | null;
  verified_name: string | null;
  status: string;
  connected_at: string | null;
};

type SignupSession = {
  wabaId?: string;
  phoneNumberId?: string;
};

type EmbeddedSignupPayload = {
  type?: string;
  event?: string;
  data?: {
    waba_id?: string;
    phone_number_id?: string;
    business_id?: string;
  };
};

const connectionKey = (organizationId: string) =>
  ["organization", organizationId, "whatsapp-connection"] as const;

const appId = import.meta.env.VITE_META_APP_ID as string | undefined;
const configId = import.meta.env
  .VITE_WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID as string | undefined;

function loadFacebookSdk() {
  return new Promise<void>((resolve, reject) => {
    if (window.FB) {
      resolve();
      return;
    }

    window.fbAsyncInit = () => resolve();

    const existing = document.getElementById("facebook-jssdk");

    if (existing) {
      const interval = window.setInterval(() => {
        if (window.FB) {
          window.clearInterval(interval);
          resolve();
        }
      }, 100);

      window.setTimeout(() => {
        window.clearInterval(interval);

        if (!window.FB) {
          reject(new Error("Não foi possível carregar a Meta."));
        }
      }, 10000);

      return;
    }

    const script = document.createElement("script");

    script.id = "facebook-jssdk";
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    script.src = "https://connect.facebook.net/pt_BR/sdk.js";
    script.onerror = () =>
      reject(new Error("Não foi possível carregar a Meta."));

    document.body.appendChild(script);
  });
}

export function WhatsAppSettingsPanel({
  editable,
}: {
  editable: boolean;
}) {
  const { organizationId } = useAppState();
  const { notify } = useToast();
  const queryClient = useQueryClient();

  const [sdkReady, setSdkReady] = useState(false);
  const signupRef = useRef<SignupSession>({});

  const configured = Boolean(appId && configId);

  useEffect(() => {
    if (!configured || !appId) {
      console.warn("[WhatsApp Embedded Signup] Ambiente não configurado", {
        hasAppId: Boolean(appId),
        hasConfigId: Boolean(configId),
      });
      setSdkReady(false);
      return;
    }

    let active = true;

    loadFacebookSdk()
      .then(() => {
        if (!active || !window.FB) return;

        window.FB.init({
          appId,
          cookie: true,
          xfbml: false,
          version: "v26.0",
        });

        console.info("[WhatsApp Embedded Signup] SDK Meta inicializado", {
          appId,
          configId,
        });

        setSdkReady(true);
      })
      .catch((error) => {
        console.error(
          "[WhatsApp Embedded Signup] Falha ao carregar SDK",
          error,
        );

        if (active) setSdkReady(false);
      });

    return () => {
      active = false;
    };
  }, [configured]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (
        event.origin !== "https://www.facebook.com" &&
        event.origin !== "https://web.facebook.com"
      ) {
        return;
      }

      let payload: EmbeddedSignupPayload;

      if (typeof event.data === "string") {
        try {
          payload = JSON.parse(event.data) as EmbeddedSignupPayload;
        } catch {
          console.debug(
            "[WhatsApp Embedded Signup] Mensagem da Meta ignorada: não é JSON",
            event.data,
          );
          return;
        }
      } else {
        payload = event.data as EmbeddedSignupPayload;
      }

      if (!payload || payload.type !== "WA_EMBEDDED_SIGNUP") {
        return;
      }

      console.info(
        "[WhatsApp Embedded Signup] Evento recebido",
        payload,
      );

      if (payload.event === "FINISH") {
        signupRef.current = {
          wabaId: payload.data?.waba_id,
          phoneNumberId: payload.data?.phone_number_id,
        };

        console.info(
          "[WhatsApp Embedded Signup] Sessão finalizada",
          signupRef.current,
        );
      }

      if (payload.event === "CANCEL") {
        signupRef.current = {};

        console.warn(
          "[WhatsApp Embedded Signup] Usuário cancelou o fluxo",
          payload,
        );
      }

      if (payload.event === "ERROR") {
        console.error(
          "[WhatsApp Embedded Signup] Meta retornou erro de sessão",
          payload,
        );
      }
    };

    window.addEventListener("message", handler);

    return () => {
      window.removeEventListener("message", handler);
    };
  }, []);

  const connectionQuery = useQuery({
    queryKey: connectionKey(organizationId),
    enabled: Boolean(organizationId && supabase),

    queryFn: async () => {
      if (!supabase) return null as Connection | null;

      const result = await supabase
        .from("whatsapp_connections")
        .select(
          "id,organization_id,waba_id,phone_number_id,display_phone_number,verified_name,status,connected_at",
        )
        .eq("organization_id", organizationId)
        .eq("status", "active")
        .maybeSingle();

      if (result.error) {
        console.error(
          "[WhatsApp Embedded Signup] Falha ao carregar conexão existente",
          result.error,
        );

        throw new Error(
          "Não foi possível carregar a conexão do WhatsApp.",
        );
      }

      return (result.data ?? null) as Connection | null;
    },
  });

  const connect = useMutation({
    mutationFn: async () => {
      if (!supabase) {
        throw new Error("Supabase não configurado.");
      }

      if (!configured || !appId || !configId) {
        throw new Error(
          "Integração com a Meta ainda não está configurada.",
        );
      }

      if (!sdkReady || !window.FB) {
        throw new Error(
          "A integração com a Meta ainda está carregando. Tente novamente em alguns segundos.",
        );
      }

      signupRef.current = {};

      console.info(
        "[WhatsApp Embedded Signup] Abrindo FB.login",
        {
          appId,
          configId,
          responseType: "code",
          authType: "rerequest",
        },
      );

      const code = await new Promise<string>((resolve, reject) => {
        window.FB!.login(
          (response) => {
            console.info(
              "[WhatsApp Embedded Signup] Callback FB.login",
              {
                status: response.status,
                hasAuthResponse: Boolean(response.authResponse),
                hasCode: Boolean(response.authResponse?.code),
              },
            );

            const authorizationCode = response.authResponse?.code;

            if (!authorizationCode) {
              console.error(
                "[WhatsApp Embedded Signup] Nenhum authorization code retornado",
                response,
              );

              reject(
                new Error("Conexão cancelada ou não autorizada."),
              );
              return;
            }

            resolve(authorizationCode);
          },
          {
            config_id: configId,
            auth_type: "rerequest",
            response_type: "code",
            override_default_response_type: true,
            extras: {
              setup: {},
            },
          },
        );
      });

      console.info(
        "[WhatsApp Embedded Signup] Authorization code recebido",
      );

      const session = await new Promise<SignupSession>(
        (resolve, reject) => {
          const startedAt = Date.now();

          const timer = window.setInterval(() => {
            const current = signupRef.current;

            if (current.wabaId && current.phoneNumberId) {
              window.clearInterval(timer);

              console.info(
                "[WhatsApp Embedded Signup] IDs da sessão recebidos",
                current,
              );

              resolve(current);
              return;
            }

            if (Date.now() - startedAt > 15000) {
              window.clearInterval(timer);

              console.error(
                "[WhatsApp Embedded Signup] Timeout aguardando waba_id e phone_number_id",
                signupRef.current,
              );

              reject(
                new Error(
                  "A Meta autorizou o acesso, mas não retornou os dados do número. Verifique o Console e tente novamente.",
                ),
              );
            }
          }, 150);
        },
      );

      console.info(
        "[WhatsApp Embedded Signup] Enviando dados para Edge Function",
        {
          organizationId,
          wabaId: session.wabaId,
          phoneNumberId: session.phoneNumberId,
          hasCode: true,
        },
      );

      const result = await supabase.functions.invoke(
        "whatsapp-embedded-signup",
        {
          body: {
            organizationId,
            code,
            wabaId: session.wabaId,
            phoneNumberId: session.phoneNumberId,
          },
        },
      );

      console.info(
        "[WhatsApp Embedded Signup] Resposta da Edge Function",
        {
          hasError: Boolean(result.error),
          data: result.data,
        },
      );

      if (result.error) {
        let message = result.error.message;

        if (
          result.data &&
          typeof result.data === "object" &&
          "message" in result.data &&
          typeof result.data.message === "string"
        ) {
          message = result.data.message;
        }

        console.error(
          "[WhatsApp Embedded Signup] Edge Function retornou erro",
          {
            error: result.error,
            data: result.data,
          },
        );

        throw new Error(
          message || "Não foi possível conectar o WhatsApp.",
        );
      }

      return result.data;
    },

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: connectionKey(organizationId),
      });

      notify({
        title: "WhatsApp conectado.",
      });
    },

    onError: (error) => {
      console.error(
        "[WhatsApp Embedded Signup] Fluxo encerrado com erro",
        error,
      );

      notify({
        title:
          error instanceof Error
            ? error.message
            : "Não foi possível conectar o WhatsApp.",
      });
    },
  });

  const connection = connectionQuery.data ?? null;

  if (connectionQuery.isLoading) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Carregando conexão do WhatsApp…
        </CardContent>
      </Card>
    );
  }

  if (connectionQuery.isError) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="font-semibold">
            Não foi possível carregar a conexão do WhatsApp.
          </p>

          <Button
            className="mt-4"
            variant="outline"
            onClick={() => void connectionQuery.refetch()}
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
        <h2 className="text-xl font-semibold">WhatsApp</h2>

        <p className="mt-1 text-sm text-muted-foreground">
          Conecte a conta do WhatsApp Business da sua empresa ao ESADS Beauty.
        </p>
      </div>

      {!connection ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircleMore size={19} />
              Conectar WhatsApp
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <p className="max-w-2xl text-sm text-muted-foreground">
              Modo de diagnóstico ativo. Abra o Console do navegador antes de
              conectar para registrar a resposta da Meta.
            </p>

            {!configured && (
              <p className="rounded-xl border p-3 text-sm">
                O Embedded Signup ainda precisa ser configurado no ambiente do
                ESADS Beauty.
              </p>
            )}

            {configured && !sdkReady && (
              <p className="rounded-xl border p-3 text-sm text-muted-foreground">
                Carregando integração com a Meta…
              </p>
            )}

            {editable && (
              <Button
                disabled={!configured || !sdkReady || connect.isPending}
                onClick={() => connect.mutate()}
              >
                {connect.isPending ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <MessageCircleMore size={16} />
                )}

                {connect.isPending
                  ? "Conectando…"
                  : "Conectar com o WhatsApp"}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 size={19} />
              WhatsApp conectado
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-muted/50 p-4">
                <span className="text-xs text-muted-foreground">Conta</span>

                <b className="mt-1 block">
                  {connection.verified_name || "WhatsApp Business"}
                </b>
              </div>

              <div className="rounded-xl bg-muted/50 p-4">
                <span className="text-xs text-muted-foreground">Número</span>

                <b className="mt-1 block">
                  {connection.display_phone_number ||
                    connection.phone_number_id}
                </b>
              </div>
            </div>

            {connection.connected_at && (
              <p className="text-xs text-muted-foreground">
                Conectado em{" "}
                {new Date(connection.connected_at).toLocaleString("pt-BR")}.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </section>
  );
}
