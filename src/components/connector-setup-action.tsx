"use client";

import { useState } from "react";

export function ConnectorSetupAction({ envVars }: { envVars: string[] }) {
  const [copied, setCopied] = useState(false);

  if (envVars.length === 0) return null;

  async function handleCopy() {
    const text = envVars.map((name) => `${name}=""`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — button stays usable, just no copy feedback.
    }
  }

  return (
    <button type="button" className="button" onClick={handleCopy}>
      {copied ? "Copied" : "Copy setup keys"}
    </button>
  );
}
