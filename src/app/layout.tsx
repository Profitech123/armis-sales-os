import type { Metadata } from "next";
import { AppNavigation } from "@/components/app-navigation";
import "./globals.css";

export const metadata: Metadata = {
  title: "Armis Sales OS",
  description: "AI-powered sales intelligence control center for Armis Middle East.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body><AppNavigation />{children}</body>
    </html>
  );
}
