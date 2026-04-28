import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { SettingsProvider } from "@/contexts/settings.context";

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
        <SettingsProvider>
          <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
            <Sidebar />
            <main className="flex-1 min-w-0 overflow-auto">{children}</main>
          </div>
        </SettingsProvider>
      </body>
    </html>
  );
}
