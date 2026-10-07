"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatTaskDate, todayKey } from "@/lib/date";
import type { Task, TaskCategory, TaskPriority } from "@/lib/types";

const categoryLabels: Record<TaskCategory,string> = {
  work:"Trabajo", personal:"Personal", family:"Familia", finance:"Finanzas", home:"Casa", shopping:"Compras", appointments:"Citas", projects:"Proyectos", health:"Salud", other:"Otro",
};
const priorityLabels: Record<TaskPriority,string> = { low:"Baja", medium:"Media", high:"Alta", urgent:"Urgente" };

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

export default function DashboardClient({ initialTasks, email, profile }: { initialTasks: Task[]; email: string; profile: {full_name: string|null; timezone: string|null}|null }) {
  const supabase = createClient();
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [capture, setCapture] = useState("");
  const [busy, setBusy] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [filter, setFilter] = useState<"today"|"pending"|"all">("today");
  const [notice, setNotice] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [linkBusy, setLinkBusy] = useState(false);

  const today = todayKey();
  const stats = useMemo(() => {
    const pending = tasks.filter(t => t.status !== "completed" && t.status !== "cancelled").length;
    const completed = tasks.filter(t => t.status === "completed").length;
    const overdue = tasks.filter(t => t.due_at && new Date(t.due_at) < new Date() && t.status !== "completed" && t.status !== "cancelled").length;
    const todayCount = tasks.filter(t => t.due_at?.slice(0,10) === today && t.status !== "completed" && t.status !== "cancelled").length;
    return { pending, completed, overdue, todayCount };
  }, [tasks, today]);

  const visible = useMemo(() => tasks.filter(t => {
    if (filter === "all") return true;
    if (filter === "pending") return t.status !== "completed" && t.status !== "cancelled";
    return t.due_at?.slice(0,10) === today && t.status !== "cancelled";
  }), [tasks, filter, today]);

  async function captureTask(source: "manual"|"voice_web" = "manual") {
    if (!capture.trim() || busy) return;
    setBusy(true); setNotice("");
    try {
      const res = await fetch("/api/tasks/interpret", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ input:capture, source }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo crear la tarea.");
      setTasks(prev => [data.task, ...prev]);
      setCapture("");
      setNotice("Tarea capturada. Ya está fuera de tu cabeza.");
    } catch (e) { setNotice(e instanceof Error ? e.message : "Error inesperado."); }
    finally { setBusy(false); }
  }

  function startVoice() {
    const SpeechRecognition = (window as typeof window & { SpeechRecognition?: new() => any; webkitSpeechRecognition?: new() => any }).SpeechRecognition || (window as typeof window & {webkitSpeechRecognition?: new() => any}).webkitSpeechRecognition;
    if (!SpeechRecognition) { setNotice("Tu navegador no permite dictado web. Usa Chrome/Edge o envía una nota de voz por WhatsApp."); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = "es-DO"; recognition.interimResults = false; recognition.continuous = false;
    setVoiceBusy(true); setNotice("Te escucho…");
    recognition.onresult = (event: any) => { setCapture(event.results[0][0].transcript); };
    recognition.onerror = () => setNotice("No pude entender el audio. Intenta otra vez.");
    recognition.onend = () => setVoiceBusy(false);
    recognition.start();
  }

  async function toggleTask(task: Task) {
    const nextStatus = task.status === "completed" ? "pending" : "completed";
    const { error } = await supabase.from("tasks").update({ status: nextStatus, completed_at: nextStatus === "completed" ? new Date().toISOString() : null }).eq("id", task.id);
    if (error) { setNotice(error.message); return; }
    setTasks(prev => prev.map(t => t.id === task.id ? {...t, status: nextStatus, completed_at: nextStatus === "completed" ? new Date().toISOString() : null} : t));
  }

  async function deleteTask(id: string) {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) { setNotice(error.message); return; }
    setTasks(prev => prev.filter(t => t.id !== id));
  }

  async function linkWhatsApp() {
    if (!whatsapp.trim()) return;
    setLinkBusy(true); setNotice("");
    try {
      const res = await fetch("/api/whatsapp/link", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ phone: whatsapp }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo vincular.");
      setNotice(`WhatsApp vinculado. Envía una nota de voz o texto al número del bot.`);
      setWhatsapp("");
    } catch(e) { setNotice(e instanceof Error ? e.message : "No se pudo vincular WhatsApp."); }
    finally { setLinkBusy(false); }
  }

  const initials = (profile?.full_name || email).slice(0,1).toUpperCase();

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand"><div className="logo">✓</div><div>FOCO<small>organización anti-procrastinación</small></div></div>
        <div style={{display:"flex", alignItems:"center", gap:10}}><div className="avatar">{initials}</div><form action="/auth/signout" method="post"><button className="btn ghost" type="submit">Salir</button></form></div>
      </header>

      <section className="card dashboard-head">
        <div><div className="eyebrow">Panel personal</div><h1>{greeting()}{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}.</h1><p className="muted" style={{marginBottom:0}}>Tu objetivo hoy: hacer la siguiente cosa importante, no planificarla eternamente.</p></div>
        <div style={{textAlign:"right"}}><div className="muted" style={{fontSize:12}}>Progreso de hoy</div><strong style={{fontSize:28}}>{stats.completed}</strong><span className="muted"> tareas completadas</span></div>
      </section>

      <div className="grid stats" style={{marginTop:18}}>
        <div className="card stat"><div className="value">{stats.todayCount}</div><div className="label">Pendientes de hoy</div></div>
        <div className="card stat"><div className="value">{stats.pending}</div><div className="label">Pendientes totales</div></div>
        <div className="card stat"><div className="value">{stats.completed}</div><div className="label">Completadas</div></div>
        <div className="card stat"><div className="value">{stats.overdue}</div><div className="label">Atrasadas</div></div>
      </div>

      <div className="grid main" style={{marginTop:18}}>
        <section className="card">
          <div className="capture">
            <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",marginBottom:10}}><h2>Captura rápida</h2><span className="help">Escribe como hablas. La IA organiza lo demás.</span></div>
            <div className="capture-row">
              <input value={capture} onChange={e=>setCapture(e.target.value)} onKeyDown={e=>{if(e.key === "Enter") captureTask()}} placeholder='Ej.: “Mañana a las 10 llamar a Juan para confirmar la instalación”' />
              <button className="btn secondary" onClick={startVoice} disabled={voiceBusy}>{voiceBusy ? "🎙️…" : "🎙️ Voz"}</button>
              <button className="btn primary" onClick={()=>captureTask()} disabled={busy || !capture.trim()}>{busy ? "Creando…" : "Capturar"}</button>
            </div>
            {notice && <div className="notice" style={{marginTop:10}}>{notice}</div>}
          </div>
          <div style={{padding:"2px 18px 14px", display:"flex", gap:8, borderTop:"1px solid var(--line)"}}>
            {(["today","pending","all"] as const).map(f=><button key={f} className={`btn ${filter===f?"secondary":"ghost"}`} onClick={()=>setFilter(f)}>{f==="today"?"Hoy":f==="pending"?"Pendientes":"Todas"}</button>)}
          </div>
          <div className="task-list">
            {visible.length === 0 ? <div className="empty">No hay tareas en esta vista. Captura una ahora antes de que se convierta en otra cosa pendiente.</div> : visible.map(task => (
              <article className="task" key={task.id}>
                <button aria-label={task.status === "completed" ? "Reabrir tarea" : "Completar tarea"} className={`checkbox ${task.status === "completed" ? "done" : ""}`} onClick={()=>toggleTask(task)}>{task.status === "completed" ? "✓" : ""}</button>
                <div className="task-body">
                  <div className={`task-title ${task.status === "completed" ? "done" : ""}`}>{task.title}</div>
                  <div className="meta"><span className="pill category">{categoryLabels[task.category]}</span><span className={`pill ${task.priority}`}>{priorityLabels[task.priority]}</span><span className="task-date">{formatTaskDate(task.due_at)}</span>{task.estimated_minutes ? <span className="task-date">≈ {task.estimated_minutes} min</span> : null}</div>
                </div>
                <button className="btn ghost" style={{padding:"8px 10px"}} onClick={()=>deleteTask(task.id)}>×</button>
              </article>
            ))}
          </div>
        </section>

        <aside className="card side">
          <div className="side-section">
            <div className="eyebrow">WhatsApp</div><h2 style={{marginTop:6}}>Tu bandeja de captura</h2>
            <p className="muted">Vincula tu número una sola vez. Luego podrás escribir o mandar notas de voz al WhatsApp del bot y Foco intentará crear la tarea automáticamente.</p>
            <div className="field"><label>Número personal con código de país</label><input placeholder="1809XXXXXXX" value={whatsapp} onChange={e=>setWhatsapp(e.target.value.replace(/\D/g,""))}/></div>
            <button className="btn primary" style={{width:"100%", marginTop:10}} onClick={linkWhatsApp} disabled={linkBusy || !whatsapp}>{linkBusy?"Vinculando…":"Vincular WhatsApp"}</button>
            <div className="help" style={{marginTop:9}}>El webhook de Meta debe apuntar a <strong>/api/whatsapp/webhook</strong>.</div>
          </div>
          <div className="side-section">
            <div className="eyebrow">Regla anti-procrastinación</div><h2 style={{marginTop:6}}>No guardes tareas perfectas.</h2>
            <p className="muted">Captura la versión imperfecta. El sistema puede ordenar la categoría, prioridad y fecha; tu trabajo es empezar.</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
