import { useEffect, useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserAvatar } from "@/shared/components/data-display/user-avatar";
import { useToast } from "@/shared/components/feedback/toast";
import {
  useCurrentUserProfile,
  useProfileActions,
} from "./hooks";

export function ProfilePanel() {
  const profile = useCurrentUserProfile();
  const actions = useProfileActions();
  const { notify } = useToast();
  const input = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    setName(profile.data?.name ?? "");
    setEmail(profile.data?.email ?? "");
  }, [profile.data?.name, profile.data?.email]);

  if (!profile.data) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Carregando perfil…
        </CardContent>
      </Card>
    );
  }

  const busy =
    actions.saveName.isPending ||
    actions.changeEmail.isPending ||
    actions.uploadAvatar.isPending ||
    actions.removeAvatar.isPending;

  const feedback = {
    onSuccess: () =>
      notify({
        title: "Perfil atualizado.",
      }),
    onError: (error: Error) =>
      notify({
        title: error.message,
      }),
  };

  const saveProfile = async () => {
    const nextName = name.trim();
    const nextEmail = email.trim().toLowerCase();

    if (!nextName || !nextEmail) {
      notify({
        title: "Preencha nome e e-mail.",
      });
      return;
    }

    try {
      if (nextName !== profile.data.name) {
        await actions.saveName.mutateAsync({
          name: nextName,
          avatarPath: profile.data.avatarPath,
        });
      }

      if (nextEmail !== profile.data.email.toLowerCase()) {
        await actions.changeEmail.mutateAsync(nextEmail);
      }

      notify({
        title: "Perfil atualizado.",
      });
    } catch (error) {
      notify({
        title:
          error instanceof Error
            ? error.message
            : "Não foi possível atualizar o perfil.",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Meu perfil</CardTitle>
      </CardHeader>

      <CardContent className="grid gap-6 md:grid-cols-[auto_minmax(0,1fr)]">
        <div className="flex flex-col items-center gap-3">
          <UserAvatar
            size="lg"
            name={profile.data.name}
            email={profile.data.email}
            src={profile.data.avatarUrl}
          />

          <input
            ref={input}
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0];

              if (file) {
                actions.uploadAvatar.mutate(
                  {
                    file,
                    name,
                    previousPath: profile.data?.avatarPath,
                  },
                  feedback,
                );
              }

              event.currentTarget.value = "";
            }}
          />

          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            <Camera size={17} />
            {profile.data.avatarPath ? "Trocar foto" : "Enviar foto"}
          </Button>

          {profile.data.avatarPath && (
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() =>
                actions.removeAvatar.mutate(
                  {
                    name,
                    path: profile.data?.avatarPath,
                  },
                  feedback,
                )
              }
            >
              <Trash2 size={17} />
              Remover foto
            </Button>
          )}

          <p className="max-w-48 text-center text-xs text-muted-foreground">
            JPEG, PNG ou WebP. Máximo de 5 MB.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="profile-name">Nome</Label>
            <Input
              id="profile-name"
              className="mt-1"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
            />
          </div>

          <div>
            <Label htmlFor="profile-email">E-mail</Label>
            <Input
              id="profile-email"
              className="mt-1"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Este e-mail será usado para acessar sua conta.
            </p>
          </div>

          <Button
            disabled={busy || !name.trim() || !email.trim()}
            onClick={() => void saveProfile()}
          >
            {busy ? "Salvando…" : "Salvar alterações"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
