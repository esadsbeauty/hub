import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/providers/auth-provider";

const schema = z.object({ email: z.string().email(), password: z.string() });
type Form = z.infer<typeof schema>;
export function AuthPage() {
  const auth = useAuth();
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } });
  async function submit(data: Form) {
    setMessage(""); setError("");
    try {
      if (auth.passwordRecovery && data.password.length < 8) return setError("A nova senha deve possuir pelo menos 8 caracteres.");
      if (auth.passwordRecovery) { await auth.updatePassword(data.password); return setMessage("Senha atualizada com segurança."); }
      if (mode === "reset") { await auth.resetPassword(data.email); return setMessage("Enviamos as instruções de recuperação para o seu email."); }
      await auth.signIn(data.email, data.password);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível concluir agora."); }
  }
  const title = auth.passwordRecovery ? "Definir nova senha" : mode === "login" ? "Entrar" : "Recuperar senha";
  return <main className="min-h-dvh bg-sidebar p-0 text-white lg:p-6"><div className="mx-auto grid min-h-dvh max-w-6xl overflow-hidden bg-sidebar lg:min-h-[calc(100dvh-3rem)] lg:grid-cols-[1.05fr_.95fr] lg:rounded-[1.75rem]"><section className="hidden flex-col justify-between p-12 lg:flex"><div><div className="mb-12 flex items-center gap-3 text-xs font-semibold tracking-[.22em]"><Sparkles className="text-champagne" size={16}/> ESADS BEAUTY</div><h1 className="max-w-lg text-5xl font-semibold tracking-[-.045em]">Sua operação, em um só lugar.</h1><p className="mt-5 max-w-md text-sm leading-6 text-white/55">Relacionamento, rotina e resultados organizados para decisões mais claras.</p></div><p className="text-xs text-white/30">Hub Interno · Acesso reservado</p></section><form onSubmit={handleSubmit(submit)} className="my-auto min-h-dvh w-full bg-background p-6 pt-16 text-foreground sm:p-10 lg:min-h-0 lg:max-w-md lg:rounded-[1.5rem] lg:shadow-overlay"><div className="mb-12 flex items-center gap-2 text-xs font-semibold tracking-[.2em] lg:hidden"><Sparkles className="text-champagne-dark" size={15}/> ESADS BEAUTY</div><h2 className="text-2xl font-bold">{title}</h2><p className="mt-2 text-sm text-muted-foreground">Use suas credenciais para continuar.</p>{!auth.configured && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-800">Não foi possível conectar ao serviço de autenticação.</p>}<div className="mt-8 space-y-4">{!auth.passwordRecovery && <div><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="email" className="mt-1" {...register("email")}/></div>}{errors.email && !auth.passwordRecovery && <p className="text-sm text-red-600">Informe um email válido.</p>}{(mode === "login" || auth.passwordRecovery) && <div><Label htmlFor="password">{auth.passwordRecovery ? "Nova senha" : "Senha"}</Label><Input id="password" type="password" autoComplete={auth.passwordRecovery ? "new-password" : "current-password"} className="mt-1" {...register("password")}/></div>}<Button className="w-full" disabled={isSubmitting || !auth.configured}>{isSubmitting ? "Processando…" : auth.passwordRecovery ? "Salvar senha" : mode === "reset" ? "Enviar recuperação" : "Entrar"}</Button>{message && <p role="status" className="text-sm text-emerald-700">{message}</p>}{error && <p role="alert" className="text-sm text-red-700">{error}</p>}</div>{!auth.passwordRecovery && <div className="mt-6 text-right text-sm"><button type="button" onClick={() => setMode(mode === "login" ? "reset" : "login")}>{mode === "login" ? "Esqueci a senha" : "Voltar ao acesso"}</button></div>}</form></div></main>;
}
