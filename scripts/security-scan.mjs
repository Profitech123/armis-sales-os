import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" }).trim().split("\n");
const untracked = execFileSync("git", ["ls-files", "--others", "--exclude-standard"], { encoding: "utf8" }).trim().split("\n");
const files = [...new Set([...tracked, ...untracked])].filter(Boolean).filter((file) => !file.startsWith("package-lock.json"));
const credentialPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{16,}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,
  /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\b/,
];
const personalEmail = /\b[A-Z0-9._%+-]+@(?!example\.com\b|unavailable\.invalid\b)[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const findings = [];
for (const file of files) {
  let content;
  try { content = readFileSync(file, "utf8"); } catch { continue; }
  if (credentialPatterns.some((pattern) => pattern.test(content))) findings.push(`${file}: possible credential`);
  if (!file.startsWith("tests/") && personalEmail.test(content)) findings.push(`${file}: possible personal email`);
}
if (findings.length) {
  process.stderr.write(`${findings.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Security scan passed across ${files.length} tracked and untracked files\n`);
}
