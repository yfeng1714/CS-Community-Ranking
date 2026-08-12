import { createHmac } from "node:crypto";
import { isIP } from "node:net";

import { dateInTimeZone } from "@/domain/ballots/date";

function normalizeIpv4(value: string): string | null {
  if (isIP(value) !== 4) return null;
  return value
    .split(".")
    .map((part) => Number(part).toString())
    .join(".");
}

function expandIpv6(value: string): number[] | null {
  if (isIP(value) !== 6) return null;
  const [head = "", tail = "", extra] = value.toLowerCase().split("::");
  if (extra !== undefined) return null;

  const parseParts = (section: string): number[] | null => {
    if (!section) return [];
    const output: number[] = [];
    for (const part of section.split(":")) {
      if (part.includes(".")) {
        const ipv4 = normalizeIpv4(part);
        if (!ipv4) return null;
        const bytes = ipv4.split(".").map(Number);
        output.push((bytes[0]! << 8) | bytes[1]!, (bytes[2]! << 8) | bytes[3]!);
      } else {
        const parsed = Number.parseInt(part, 16);
        if (!/^[0-9a-f]{1,4}$/.test(part) || !Number.isFinite(parsed)) return null;
        output.push(parsed);
      }
    }
    return output;
  };

  const headParts = parseParts(head);
  const tailParts = parseParts(tail);
  if (!headParts || !tailParts) return null;
  if (!value.includes("::") && headParts.length !== 8) return null;
  const missing = 8 - headParts.length - tailParts.length;
  if (missing < (value.includes("::") ? 1 : 0)) return null;
  return [...headParts, ...Array.from({ length: missing }, () => 0), ...tailParts];
}

export function normalizeIpForRisk(value: string): string | null {
  const candidate = value.trim();
  const ipv4 = normalizeIpv4(candidate);
  if (ipv4) return ipv4;
  const mappedIpv4 = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(candidate)?.[1];
  if (mappedIpv4) return normalizeIpv4(mappedIpv4);

  const ipv6 = expandIpv6(candidate);
  if (!ipv6) return null;
  return `${ipv6
    .slice(0, 4)
    .map((part) => part.toString(16).padStart(4, "0"))
    .join(":")}::/64`;
}

export function deriveDailyIpRiskKey(input: {
  date: string;
  ip: string;
  secret: string;
}): Buffer | null {
  const normalized = normalizeIpForRisk(input.ip);
  if (!normalized) return null;
  return createHmac("sha256", input.secret).update(`${input.date}|${normalized}`, "utf8").digest();
}

export function extractDailyIpRiskKey(
  headers: Pick<Headers, "get">,
  options: {
    clientIpMode: "cloudflare" | "railway";
    now: Date;
    secret: string;
    timeZone: string;
    trustProxyHeaders: boolean;
  },
): Buffer | null {
  if (!options.trustProxyHeaders) return null;
  const headerName = options.clientIpMode === "cloudflare" ? "cf-connecting-ip" : "x-real-ip";
  const rawIp = headers.get(headerName);
  if (!rawIp || rawIp.includes(",")) return null;
  return deriveDailyIpRiskKey({
    date: dateInTimeZone(options.now, options.timeZone),
    ip: rawIp,
    secret: options.secret,
  });
}
