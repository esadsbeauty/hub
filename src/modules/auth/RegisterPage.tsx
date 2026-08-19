import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/providers/auth-context";

const registerSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome."),
  email: z.string().trim().email("Informe um email válido."),
  password: z.string().min(8, "A senha deve possuir pelo menos 8 caracteres."),
  passwordConfirmation: z.string(),
}).refine((data) => data.password === data.passwordConfirmation, { path: ["passwordConfirmation"], message: "As senhas não coincidem." });
type RegisterForm = z.infer<typeof registerSchema>;
type Result = "pending" | "confirmation_required" | null;

export function RegisterPage() {
  const auth = useAuth(); const navigate = useNavigate(); const [result, setResult] = useState<Result>(null); const [error, setError] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema), defaultValues: { name: "", email: "", password: "", passwordConfirmation: "" } });
  if (auth.appMode !== "supabase") return <Navigate to="/login" replace/>;
  if (auth.authenticated && !isSubmitting && !result) return <Navigate to="/" replace/>;
  const submit: SubmitHandler<RegisterForm> = async (data) => { setError(""); try { const access = await auth.signUp(data.name, data.email, data.password); if (access.status === "active") { window.location.assign("/"); return; } setResult(access.status); } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível criar o cadastro."); } };
  if (result) return <main className="grid min-h-dvh place-items-center bg-sidebar p-5"><section className="w-full max-w-md rounded-[1.5rem] bg-background p-8 text-center shadow-overlay sm:p-10"><Sparkles className="mx-auto text-champagne-dark"/><h1 className="mt-5 text-[2rem] font-bold leading-tight tracking-[-.035em] sm:text-2xl">{result === "pending" ? "Cadastro recebido" : "Confirme seu email"}</h1><p className="mt-3 text-[17px] leading-7 text-muted-foreground sm:text-sm sm:leading-6">{result === "pending" ? "Seu acesso foi criado e está aguardando aprovação do administrador." : "Enviamos uma confirmação para seu email. Depois de confirmar, faça login para concluirmos seu acesso."}</p><Button className="mt-7 w-full" onClick={() => navigate("/login", { replace: true })}>Voltar para o login</Button></section></main>;
  return <main className="min-h-dvh bg-sidebar p-4 text-white sm:grid sm:place-items-center"><form onSubmit={handleSubmit(submit)} className="mx-auto min-h-[calc(100dvh-2rem)] w-full max-w-md rounded-[1.5rem] bg-background p-7 pt-12 text-foreground min-[430px]:p-8 min-[430px]:pt-12 shadow-overlay sm:min-h-0 sm:p-10"><div className="flex items-center gap-2 text-xs font-semibold tracking-[.2em]"><Sparkles className="text-champagne-dark" size={15}/> ESADS BEAUTY</div><h1 className="mt-9 text-[2rem] font-bold leading-tight tracking-[-.035em] sm:mt-8 sm:text-2xl">Criar cadastro</h1><p className="mt-2.5 text-[17px] leading-7 text-muted-foreground sm:mt-2 sm:text-sm sm:leading-normal">Solicite seu acesso ao Hub Interno.</p><div className="mt-8 space-y-5 sm:mt-7 sm:space-y-4"><Field label="Nome" error={errors.name?.message}><Input autoComplete="name" className="sm:h-11" {...register("name")}/></Field><Field label="Email" error={errors.email?.message}><Input type="email" inputMode="email" autoComplete="email" className="sm:h-11" {...register("email")}/></Field><Field label="Senha" error={errors.password?.message}><Input type="password" autoComplete="new-password" className="sm:h-11" {...register("password")}/></Field><Field label="Confirmar senha" error={errors.passwordConfirmation?.message}><Input type="password" autoComplete="new-password" className="sm:h-11" {...register("passwordConfirmation")}/></Field>{error && <p role="alert" className="text-sm text-danger">{error}</p>}<Button className="w-full sm:h-11" disabled={isSubmitting}>{isSubmitting ? "Criando cadastro…" : "Criar cadastro"}</Button></div><p className="mt-7 text-center text-base text-muted-foreground sm:mt-6 sm:text-sm">Já possui acesso? <Link className="font-semibold text-foreground underline-offset-4 hover:underline" to="/login">Entrar</Link></p></form></main>;
}
function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) { return <label className="block"><Label>{label}</Label><div className="mt-1">{children}</div>{error && <span className="mt-1 block text-sm text-danger">{error}</span>}</label>; }
