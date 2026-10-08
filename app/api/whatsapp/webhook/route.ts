import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import OpenAI from "openai";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOpenAI } from "@/lib/openai";
import { downloadWhatsAppMedia, getWhatsAppMediaUrl, sendWhatsAppText } from "@/lib/whatsapp";
import { parseTaskText } from "@/lib/task-parser";

export const runtime = "nodejs";

function verifySignature(raw: string, signature: string | null) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return true; // En desarrollo sin App Secret configurado.
  if (!signature?.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  const received = signature.slice(7);
  if (expected.length !== received.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

async function transcribeAudio(buffer: Buffer) {
  const openai = getOpenAI();
  const tempPath = path.join(os.tmpdir(), `foco-${crypto.randomUUID()}.ogg`);

  try {
    await fs.writeFile(tempPath, buffer);
    const transcription = await openai.audio.transcriptions.create({
      file: OpenAI.toFile ? await OpenAI.toFile(buffer, "whatsapp-voice.ogg", { type: "audio/ogg" }) : fs.createReadStream(tempPath),
      model: process.env.OPENAI_TRANSCRIPTION_MODEL || "gpt-4o-mini-transcribe",
      language: "es",
    });
    return transcription.text;
  } finally {
    await fs.rm(tempPath, { force: true });
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) return new Response(challenge || "", { status: 200 });
  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifySignature(raw, request.headers.get("x-hub-signature-256"))) return new Response("Invalid signature", { status: 401 });

  try {
    const payload = JSON.parse(raw) as any;
    const admin = createAdminClient();
    const messages = payload?.entry?.flatMap((entry: any) => entry?.changes || []).flatMap((change: any) => change?.value?.messages || []) || [];

    for (const message of messages) {
      const phone = String(message.from || "");
      const messageId = String(message.id || "");
      if (!phone || !messageId) continue;

      const { data: existing } = await admin.from("whatsapp_messages").select("id").eq("message_id", messageId).maybeSingle();
      if (existing) continue;

      const { data: contact } = await admin.from("whatsapp_contacts").select("user_id").eq("phone_number", phone).maybeSingle();
      if (!contact?.user_id) {
        await admin.from("whatsapp_messages").insert({ message_id: messageId, phone_number: phone, message_type: message.type || "unknown", body: null, raw_payload: payload });
        await sendWhatsAppText(phone, "Tu número todavía no está vinculado a Foco. Vincúlalo desde la aplicación y vuelve a enviarme el mensaje.");
        continue;
      }

      let text = "";
      if (message.type === "text") text = String(message.text?.body || "").trim();
      if (message.type === "audio") {
        const mediaId = String(message.audio?.id || "");
        if (mediaId) {
          const mediaUrl = await getWhatsAppMediaUrl(mediaId);
          const buffer = await downloadWhatsAppMedia(mediaUrl);
          text = (await transcribeAudio(buffer)).trim();
        }
      }

      await admin.from("whatsapp_messages").insert({ message_id: messageId, phone_number: phone, message_type: message.type || "unknown", body: text || null, raw_payload: payload });
      await admin.from("whatsapp_contacts").update({ last_inbound_at: new Date().toISOString() }).eq("phone_number", phone);
      if (!text) {
        await sendWhatsAppText(phone, "Puedo procesar texto y notas de voz. Envíame algo como: “Mañana a las 9 llamar a Juan”.");
        continue;
      }

      const task = await parseTaskText(text);
      const { error } = await admin.from("tasks").insert({
        user_id: contact.user_id,
        title: task.title,
        notes: task.notes ?? null,
        category: task.category,
        priority: task.priority,
        due_at: task.due_at ?? null,
        estimated_minutes: task.estimated_minutes ?? null,
        recurrence: task.recurrence ?? null,
        source: "whatsapp",
        status: "pending",
      });
      if (error) throw error;

      const when = task.due_at ? `\n📅 ${new Intl.DateTimeFormat("es-DO", { dateStyle:"medium", timeStyle:"short" }).format(new Date(task.due_at))}` : "";
      await sendWhatsAppText(phone, `✅ Tarea creada:\n${task.title}${when}\n\nCategoría: ${task.category}\nPrioridad: ${task.priority}`);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("WhatsApp webhook error", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Webhook error" }, { status: 500 });
  }
}
