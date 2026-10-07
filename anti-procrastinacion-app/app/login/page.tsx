"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      if (mode === "login") {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
        router.replace("/dashboard");
        router.refresh();
      } else {
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
        });
        if (authError) throw authError;
        setMessage(data.session ? "Cuenta creada. Entrando..." : "Cuenta creada. Revisa tu correo para confirmar el acceso.");
        if (data.session) router.replace("/dashboard");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar la operación.");
    } finally { setBusy(false); }
  }

  return (
    <main className="login-wrap">
      <section className="card login">
        <div className="brand"><div className="logo">✓</div><div>FOCO<small>tu día, sin excusas</small></div></div>
        <h1 style={{fontSize: 34, marginTop: 26}}>Menos pensar.<br/>Más hacer.</h1>
        <p className="muted">Captura un pendiente como te salga de la cabeza. Foco lo convierte en una tarea accionable.</p>
        <form onSubmit={submit}>
          <div className="field"><label>Correo</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email" /></div>
          <div className="field"><label>Contraseña</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={6} autoComplete={mode === "login" ? "current-password" : "new-password"}/></div>
          {message && <div className="notice success">{message}</div>}
          {error && <div className="notice error">{error}</div>}
          <div className="login-actions">
            <button className="btn primary" disabled={busy}>{busy ? "Procesando…" : mode === "login" ? "Entrar" : "Crear cuenta"}</button>
            <button type="button" className="btn secondary" onClick={()=>setMode(mode === "login" ? "signup" : "login")}>{mode === "login" ? "Registrarme" : "Ya tengo cuenta"}</button>
          </div>
        </form>
        <div className="footer-note">MVP personal. La clave secreta de OpenAI nunca se envía al navegador.</div>
      </section>
    </main>
  );
}
