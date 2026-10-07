import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function normalizePhone(phone: string) { return phone.replace(/\D/g, ""); }

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub;
    if (!userId) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

    const body = await request.json() as { phone?: string };
    const phone = normalizePhone(String(body.phone || ""));
    if (phone.length < 10 || phone.length > 15) return NextResponse.json({ error: "Número de WhatsApp no válido. Usa país + número sin espacios." }, { status: 400 });

    const { error } = await supabase.from("whatsapp_contacts").upsert({ phone_number: phone, user_id: userId }, { onConflict: "phone_number" });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo vincular el número." }, { status: 500 });
  }
}
