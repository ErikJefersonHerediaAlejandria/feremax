import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ProveedorTienda } from "@/contexto/tienda";
import { SITIO } from "@/lib/sitio";
import "./globals.css";

// Sin preload: la fuente no compite con el HTML ni con la imagen principal (LCP); "swap" muestra el texto de inmediato.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap", preload: false });

export const metadata: Metadata = {
  metadataBase: new URL(SITIO),
  title: { default: "FerreMax · Ferretería en Lima", template: "%s · FerreMax" },
  description:
    "FerreMax: venta directa & mayorista de herramientas, materiales de construcción, gasfitería, electricidad y pinturas en Lima, Perú. Precios con IGV.",
  icons: { icon: "/favicon.svg" },
  openGraph: { siteName: "FerreMax", locale: "es_PE", type: "website" },
};

export const viewport: Viewport = { themeColor: "#0f2a4a", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={inter.variable}>
      <head>
      </head>
      <body className="flex min-h-screen flex-col font-sans">
        <ProveedorTienda>{children}</ProveedorTienda>
      </body>
    </html>
  );
}
