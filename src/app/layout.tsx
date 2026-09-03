import type { Metadata, Viewport } from "next";
import { AppNavigation } from "@/components/app-navigation";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Armis Sales OS", template: "%s | Armis Sales OS" },
  description: "AI-powered sales intelligence control center for Armis Middle East.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-AE">
      <body><a className="skip-link" href="#main-content">Skip to content</a><AppNavigation /><div id="main-content">{children}</div></body>
    </html>
  );
}
