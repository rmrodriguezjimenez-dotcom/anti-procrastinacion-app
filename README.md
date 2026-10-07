# FOCO — app personal anti-procrastinación

MVP web/PWA pensado para que registrar pendientes requiera el mínimo esfuerzo posible.

## Incluye en esta versión

- Inicio de sesión con Supabase Auth.
- Base de datos PostgreSQL en Supabase.
- Row Level Security (cada usuario ve y modifica solamente sus tareas).
- Captura rápida: escribes una frase natural y la IA la convierte en una tarea estructurada.
- Dictado desde el navegador mediante Web Speech API cuando el navegador lo soporta.
- Categoría y prioridad automáticas.
- Fecha/hora interpretada desde expresiones como “mañana” o “viernes”.
- Filtros Hoy / Pendientes / Todas.
- Completar y eliminar tareas.
- Vinculación de un número de WhatsApp.
- Webhook de WhatsApp Cloud API.
- Recepción de texto y notas de voz.
- Transcripción de notas de voz con OpenAI y creación automática de la tarea.
- Dedupe de mensajes de WhatsApp por `message_id`.
- Secretos únicamente del lado del servidor.

## Estructura

```text
anti-procrastinacion-app/
├─ app/
│  ├─ api/
│  │  ├─ tasks/interpret/route.ts
│  │  └─ whatsapp/
│  │     ├─ link/route.ts
│  │     └─ webhook/route.ts
│  ├─ auth/confirm/route.ts
│  ├─ auth/signout/route.ts
│  ├─ dashboard/page.tsx
│  ├─ login/page.tsx
│  ├─ globals.css
│  ├─ layout.tsx
│  └─ page.tsx
├─ components/dashboard-client.tsx
├─ lib/
│  ├─ date.ts
│  ├─ openai.ts
│  ├─ task-parser.ts
│  ├─ types.ts
│  ├─ whatsapp.ts
│  └─ supabase/
│     ├─ admin.ts
│     ├─ client.ts
│     ├─ proxy.ts
│     └─ server.ts
├─ supabase/migrations/0001_initial.sql
├─ .env.example
├─ next.config.ts
├─ package.json
└─ proxy.ts
```

## Requisitos

- Node.js 22+.
- Una cuenta de Supabase.
- Una API key de OpenAI para clasificación/transcripción.
- Una app de Meta/WhatsApp Cloud API para la integración real de WhatsApp.

Next.js 16 usa la convención `proxy.ts` para este límite de sesión, y Supabase recomienda `@supabase/ssr` para el manejo de sesión con cookies en Next.js.

## 1. Crear proyecto y dependencias

```bash
npm install
```

## 2. Configurar Supabase

Crea un proyecto en Supabase. En el SQL Editor ejecuta el contenido de:

```text
supabase/migrations/0001_initial.sql
```

En el proyecto de Supabase, copia la Project URL y la Publishable Key desde Connect/API.

Crea `.env.local` a partir de `.env.example`:

```bash
cp .env.example .env.local
```

Completa al menos:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
OPENAI_API_KEY=...
```

El webhook requiere además:

```env
SUPABASE_SECRET_KEY=...
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_VERIFY_TOKEN=...
WHATSAPP_API_VERSION=v25.0
WHATSAPP_APP_SECRET=...
```

**Nunca** pongas `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY` ni el token de WhatsApp en variables `NEXT_PUBLIC_*`.

## 3. Ejecutar

```bash
npm run dev
```

Abre:

```text
http://localhost:3000
```

## 4. Configurar confirmación de correo

Para una prueba rápida, puedes desactivar temporalmente la confirmación de correo en Auth > Providers > Email de Supabase.

Para producción, configura la plantilla de confirmación para apuntar al flujo server-side de `app/auth/confirm/route.ts` y usa una URL del sitio que corresponda al dominio desplegado.

## 5. WhatsApp Cloud API

En Meta configura el webhook de la aplicación:

```text
https://TU-DOMINIO.com/api/whatsapp/webhook
```

Método de verificación: usa exactamente el mismo `WHATSAPP_VERIFY_TOKEN` que tienes en `.env.local`.

Suscribe el número a los eventos de mensajes.

El endpoint implementa:

- `GET` para el desafío de verificación de Meta.
- `POST` para mensajes entrantes.
- Verificación HMAC SHA-256 cuando `WHATSAPP_APP_SECRET` está configurado.
- Descarga del audio de WhatsApp y transcripción con OpenAI.

WhatsApp Cloud API limita los mensajes salientes libres según las reglas de la ventana de atención. Este MVP responde dentro del flujo iniciado por el usuario; para mensajes proactivos posteriores conviene implementar plantillas aprobadas y una capa de seguimiento del estado de la conversación.

## 6. Vincular tu teléfono

Después de iniciar sesión:

1. Entra al panel.
2. En la tarjeta de WhatsApp introduce tu número con código de país, sin `+`, espacios o guiones.
3. Pulsa “Vincular WhatsApp”.
4. Envía al número de WhatsApp conectado a Meta un texto o una nota de voz.

Ejemplo de voz:

> “Mañana a las ocho llamar a Carlos para confirmar la reparación del DVR.”

Resultado esperado:

- WhatsApp recibe el audio.
- OpenAI lo transcribe.
- La IA identifica la intención y estructura la tarea.
- Supabase guarda la tarea en el usuario dueño del número.
- El bot responde confirmando la tarea.

## 7. Producción

Despliegue recomendado: Vercel + Supabase.

Antes de producción:

- usa un token de sistema de Meta, no un token temporal;
- configura `WHATSAPP_APP_SECRET`;
- revisa las políticas RLS;
- configura un dominio HTTPS;
- establece límites de tamaño/tiempo para medios si el volumen crece;
- añade rate limiting para endpoints públicos;
- añade un sistema de vinculación de WhatsApp con código/OTP antes de permitir cuentas multiusuario.

## 8. GitHub

```bash
git init
git add .
git commit -m "feat: first functional MVP"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/TU-REPO.git
git push -u origin main
```

No subas `.env.local`.

## 9. Lo siguiente para convertirlo en producto

La base ya está preparada para agregar:

- calendario completo;
- recordatorios push y por WhatsApp;
- rutinas diarias automáticas;
- recurrencias reales;
- modo “hazlo ahora” con microtareas de 5–15 minutos;
- puntuación/progreso anti-procrastinación;
- detección de tareas estancadas;
- resumen nocturno automático;
- integración con Google Calendar;
- múltiples dispositivos/PWA instalable;
- panel de análisis del comportamiento.
