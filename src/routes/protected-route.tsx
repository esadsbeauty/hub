import { Navigate } from "react-router-dom";
import { useAuth } from "@/providers/auth-provider";
export function ProtectedRoute({ children }: { children: React.ReactNode }) { const { authenticated, loading } = useAuth(); if (loading) return <div className="grid min-h-dvh place-items-center text-sm text-muted-foreground">Validando sessão…</div>; return authenticated ? children : <Navigate to="/login" replace/>; }
