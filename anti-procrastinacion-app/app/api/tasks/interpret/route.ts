import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseTaskText } from "@/lib/task-parser";
import type { TaskSource } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub;
    if (!userId) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

    const body = await request.json() as { input?: string; source?: TaskSource };
    const input = String(body.input || "").trim();
    if (!input) return NextResponse.json({ error: "Escribe o dicta una tarea." }, { status: 400 });

    const parsed = await parseTaskText(input);
    const { data: task, error } = await supabase.from("tasks").insert({
      user_id: userId,
      title: parsed.title,
      notes: parsed.notes ?? null,
      category: parsed.category,
      priority: parsed.priority,
      due_at: parsed.due_at ?? null,
      estimated_minutes: parsed.estimated_minutes ?? null,
      recurrence: parsed.recurrence ?? null,
      source: body.source === "voice_web" ? "voice_web" : "manual",
      status: "pending",
    }).select().single();

    if (error) throw error;
    return NextResponse.json({ task });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo crear la tarea." }, { status: 500 });
  }
}
