"use client";
import RouteError from "@/components/route-error";
export default function Error({ error, reset }: { error: Error; reset: () => void }) { return <RouteError error={error} reset={reset} />; }
