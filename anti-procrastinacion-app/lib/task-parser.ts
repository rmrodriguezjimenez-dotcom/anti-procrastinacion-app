import { getOpenAI } from "@/lib/openai";
import type { ParsedTask, TaskCategory, TaskPriority } from "@/lib/types";

const categories: TaskCategory[] = ["work", "personal", "family", "finance", "home", "shopping", "appointments", "projects", "health", "other"];
const priorities: TaskPriority[] = ["low", "medium", "high", "urgent"];

function cleanJson(raw: string) {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return fenced?.[1]?.trim() ?? raw.trim();
}

function fallback(input: string): ParsedTask {
  return {
    title: input.trim().slice(0, 180),
    notes: "Capturada sin análisis de IA.",
    category: "other",
    priority: "medium",
    due_at: null,
    estimated_minutes: null,
    recurrence: null,
  };
}

export async function parseTaskText(input: string, now = new Date()): Promise<ParsedTask> {
  const text = input.trim();
  if (!text) throw new Error("La tarea está vacía.");

  if (!process.env.OPENAI_API_KEY) return fallback(text);

  const ai = getOpenAI();
  const response = await ai.responses.create({
    model: process.env.OPENAI_TASK_MODEL || "gpt-5",
    input: [
      {
        role: "system",
        content:
          "Eres un asistente de organización personal para combatir la procrastinación. Convierte la captura del usuario en una sola tarea accionable. Devuelve SOLO JSON válido, sin markdown. Campos: title (string), notes (string|null), category (work|personal|family|finance|home|shopping|appointments|projects|health|other), priority (low|medium|high|urgent), due_at (ISO 8601 o null), estimated_minutes (number|null), recurrence (string|null). Usa la fecha/hora actual como referencia para expresiones como mañana, viernes, luego, esta noche. No inventes horas específicas cuando el usuario no las dio; en ese caso usa 09:00 para una fecha explícita solo si ayuda a representar el día, y usa null cuando no se pueda determinar una fecha. Título breve y accionable. Prioridad urgente solo si existe riesgo, una fecha inmediata o una obligación crítica.",
      },
      {
        role: "user",
        content: `Fecha/hora actual: ${now.toISOString()}\nCaptura: ${text}`,
      },
    ],
  });

  try {
    const parsed = JSON.parse(cleanJson(response.output_text)) as Partial<ParsedTask>;
    const normalized: ParsedTask = {
      title: String(parsed.title || text).trim().slice(0, 180),
      notes: parsed.notes ? String(parsed.notes).slice(0, 2000) : null,
      category: categories.includes(parsed.category as TaskCategory) ? (parsed.category as TaskCategory) : "other",
      priority: priorities.includes(parsed.priority as TaskPriority) ? (parsed.priority as TaskPriority) : "medium",
      due_at: parsed.due_at ? new Date(String(parsed.due_at)).toISOString() : null,
      estimated_minutes: Number.isFinite(Number(parsed.estimated_minutes)) ? Number(parsed.estimated_minutes) : null,
      recurrence: parsed.recurrence ? String(parsed.recurrence).slice(0, 120) : null,
    };
    return normalized;
  } catch {
    return fallback(text);
  }
}
