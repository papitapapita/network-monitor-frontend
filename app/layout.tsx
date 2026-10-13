import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { SettingsProvider } from "@/contexts/settings.context";
import { QueryProvider } from "@/components/layout/QueryProvider";
import { AuthProvider } from "@/contexts/auth.context";
import { ToastProvider } from "@/contexts/toast.context";
import { BRAND } from "@/constants/brand.constants";

// The typeface of miredcontrol.com.
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: BRAND.name,
  description: BRAND.description,
  // Opened from the home-screen icon on an iPhone (NOT-220).
  appleWebApp: { capable: true, title: BRAND.name, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: BRAND.ink,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={jakarta.className} suppressHydrationWarning>
        <QueryProvider>
          <AuthProvider>
            <SettingsProvider>
              <ToastProvider>
                <AppShell>{children}</AppShell>
              </ToastProvider>
            </SettingsProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
