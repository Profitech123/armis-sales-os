import type { Metadata } from "next";
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
      <body>{children}</body>
    </html>
  );
}
