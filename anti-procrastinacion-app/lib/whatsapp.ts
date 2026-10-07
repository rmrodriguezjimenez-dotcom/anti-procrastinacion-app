const GRAPH_VERSION = process.env.WHATSAPP_API_VERSION || "v25.0";

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta ${name} en las variables de entorno.`);
  return value;
}

export async function getWhatsAppMediaUrl(mediaId: string) {
  const token = required("WHATSAPP_ACCESS_TOKEN");
  const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${mediaId}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`No se pudo obtener el medio de WhatsApp (${response.status}).`);
  const json = (await response.json()) as { url?: string };
  if (!json.url) throw new Error("WhatsApp no devolvió URL para el medio.");
  return json.url;
}

export async function downloadWhatsAppMedia(url: string) {
  const token = required("WHATSAPP_ACCESS_TOKEN");
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`No se pudo descargar el audio de WhatsApp (${response.status}).`);
  return Buffer.from(await response.arrayBuffer());
}

export async function sendWhatsAppText(to: string, body: string) {
  const token = required("WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = required("WHATSAPP_PHONE_NUMBER_ID");
  const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { preview_url: false, body },
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`WhatsApp rechazó el mensaje: ${detail}`);
  }
}
