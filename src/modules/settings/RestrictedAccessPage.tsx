import { LockKeyhole } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageContainer } from "@/shared/components/layout/page-container";

export function RestrictedAccessPage() { return <PageContainer><div className="grid min-h-[60vh] place-items-center"><Card className="max-w-lg"><CardContent className="p-10 text-center"><LockKeyhole className="mx-auto mb-5 text-champagne-dark" size={36}/><p className="text-xs font-bold uppercase tracking-[.24em] text-champagne-dark">Governança ESADS</p><h1 className="mt-2 text-2xl font-bold">Acesso restrito</h1><p className="mt-3 text-muted-foreground">Você não possui permissão para acessar esta área. Solicite acesso a um administrador da organização.</p></CardContent></Card></div></PageContainer> }
