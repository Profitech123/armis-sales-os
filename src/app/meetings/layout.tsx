import type { Metadata } from "next";
export const metadata: Metadata = { title: "Meetings", description: "Meeting transcripts, summaries, decisions, and sales intelligence." };
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
