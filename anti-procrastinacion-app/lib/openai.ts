import OpenAI from "openai";

let client: OpenAI | null = null;

export function getOpenAI() {
  if (!client) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("Falta OPENAI_API_KEY en las variables de entorno.");
    client = new OpenAI({ apiKey: key });
  }
  return client;
}
