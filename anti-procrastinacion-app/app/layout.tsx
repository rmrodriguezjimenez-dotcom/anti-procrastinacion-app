import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Foco — Organiza sin procrastinar",
  description: "Asistente personal para capturar y ejecutar pendientes con el menor esfuerzo posible.",
  applicationName: "Foco",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es">
      <head><link rel="manifest" href="/manifest.webmanifest" /><link rel="icon" href="/favicon.svg" /></head><body>{children}</body>
    </html>
  );
}
