import { getOpenAI } from "@/lib/openai";
import type { ParsedTask, TaskCategory, TaskPriority } from "@/lib/types";

const categories: TaskCategory[] = ["work", "personal", "family", "finance", "home", "shopping", "appointments", "projects", "health", "other"];
const priorities: TaskPriority[] = ["low", "medium", "high", "urgent"];

function cleanJson(raw: string) {
  const fenced = raw.match(/\`\`\`(?:json)?\s*([\s\S]*?)\s*\`\`\`/i);
  return fenced?.[1]?.trim() ?? raw.trim();
}

function fallback(input: string, now = new Date(), timeZone = "America/Santo_Domingo"): ParsedTask {
  const text = input.trim();
  const category = workSignal(text) ? "work" : "other";
  let due_at: string | null = null;

  const timeMatch = text.match(/\b(?:a\s+las|a\s+la|a\s+)?(\d{1,2})(?::(\d{2}))?\s*(a\.?\s*m\.?|p\.?\s*m\.?)?/i);
  const hour = timeMatch ? Number(timeMatch[1]) : null;
  const minute = timeMatch?.[2] ? Number(timeMatch[2]) : 0;
  const meridiem = timeMatch?.[3]?.toLowerCase() ?? "";
  const normalizedHour = hour === null ? null : (meridiem.includes("p") && hour < 12 ? hour + 12 : meridiem.includes("a") && hour === 12 ? 0 : hour);

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const base = formatter.formatToParts(now);
  const get = (type: string) => Number(base.find((part) => part.type === type)?.value ?? 0);
  let year = get("year");
  let month = get("month");
  let day = get("day");

  if (/\bmañana\b/i.test(text)) {
    const next = new Date(Date.UTC(year, month - 1, day + 1));
    year = next.getUTCFullYear();
    month = next.getUTCMonth() + 1;
    day = next.getUTCDate();
  }

  if (normalizedHour !== null) {
    // República Dominicana has UTC-4; this fallback is only used when the AI is unavailable.
    const utcMs = Date.UTC(year, month - 1, day, normalizedHour, minute, 0) + 4 * 60 * 60 * 1000;
    const candidate = new Date(utcMs);
    if (!Number.isNaN(candidate.getTime())) due_at = candidate.toISOString();
  }

  return {
    title: text.slice(0, 180),
    notes: "Capturada sin análisis de IA.",
    category,
    priority: "medium",
    due_at,
    estimated_minutes: null,
    recurrence: null,
  };
}

function localDateTimeReference(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

function workSignal(input: string) {
  return /\b(cliente|clientes|instalaci[oó]n|instalar|dvr|nvr|c[aá]mara|cctv|alarma|trabajo|oficina|servicio|cotizaci[oó]n|presupuesto|proyecto|t[eé]cnico|reuni[oó]n laboral|llamar al cliente)\b/i.test(input);
}

export async function parseTaskText(
  input: string,
  now = new Date(),
  timeZone = "America/Santo_Domingo",
): Promise<ParsedTask> {
  const text = input.trim();
  if (!text) throw new Error("La tarea está vacía.");

  if (!process.env.OPENAI_API_KEY) return fallback(text, now, timeZone);

  const ai = getOpenAI();
  const currentLocal = localDateTimeReference(now, timeZone);
  let response;
  try {
    response = await ai.responses.create({
    model: process.env.OPENAI_TASK_MODEL || "gpt-5",
    input: [
      {
        role: "system",
        content:
          "Eres un asistente de organización personal para combatir la procrastinación. Convierte la captura del usuario en una sola tarea accionable. Devuelve SOLO JSON válido, sin markdown. Campos: title (string), notes (string|null), category (work|personal|family|finance|home|shopping|appointments|projects|health|other), priority (low|medium|high|urgent), due_at (ISO 8601 con offset o null), estimated_minutes (number|null), recurrence (string|null). Usa la fecha/hora local indicada como referencia para expresiones como mañana, viernes, luego y esta noche. No inventes horas específicas cuando el usuario no las dio; usa null para la hora cuando no esté determinada. Para una fecha sin hora, representa solamente el día sin inventar una hora. Título breve y accionable. Prioridad urgente solo si existe riesgo, una fecha inmediata o una obligación crítica. Regla de categoría: tareas relacionadas con clientes, instalaciones, DVR/NVR, cámaras, CCTV, alarmas, servicios técnicos, oficina, cotizaciones o proyectos laborales normalmente son work (Trabajo), salvo que el texto indique claramente otro contexto. Si la captura mezcla palabras como instalación + cliente + DVR, clasifica como work. El due_at debe conservar exactamente el día y hora expresados por el usuario en la zona horaria indicada.",
      },
      {
        role: "user",
        content: `Fecha/hora local actual: ${currentLocal}\nZona horaria: ${timeZone}\nCaptura: ${text}`,
      },
    ],
  });
  } catch {
    return fallback(text, now, timeZone);
  }

  try {
    const parsed = JSON.parse(cleanJson(response.output_text)) as Partial<ParsedTask>;
    let category = categories.includes(parsed.category as TaskCategory)
      ? (parsed.category as TaskCategory)
      : "other";

    if (workSignal(text)) category = "work";

    const normalized: ParsedTask = {
      title: String(parsed.title || text).trim().slice(0, 180),
      notes: parsed.notes ? String(parsed.notes).slice(0, 2000) : null,
      category,
      priority: priorities.includes(parsed.priority as TaskPriority)
        ? (parsed.priority as TaskPriority)
        : "medium",
      due_at: parsed.due_at
        ? (() => {
            const date = new Date(String(parsed.due_at));
            return Number.isNaN(date.getTime()) ? null : date.toISOString();
          })()
        : null,
      estimated_minutes: Number.isFinite(Number(parsed.estimated_minutes))
        ? Number(parsed.estimated_minutes)
        : null,
      recurrence: parsed.recurrence ? String(parsed.recurrence).slice(0, 120) : null,
    };
    return normalized;
  } catch {
    return fallback(text, now, timeZone);
  }
}
