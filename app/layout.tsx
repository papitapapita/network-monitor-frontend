import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { SettingsProvider } from "@/contexts/settings.context";
import { QueryProvider } from "@/components/layout/QueryProvider";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Monitor de Red",
  description: "Administra y monitorea tu infraestructura de red",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <QueryProvider>
          <SettingsProvider>
            <AppShell>{children}</AppShell>
          </SettingsProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
