export type QueryKind = "IPv4" | "IPv6" | "CIDR" | "ASN" | "Domain";

export interface Detected {
  /** What the chip says. */
  label: QueryKind | "Anything" | "Keep typing";
  kind: QueryKind | null;
}

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const IPV6 = /^[0-9a-f:]+(:\d{1,3}(\.\d{1,3}){3})?$/i;

function isIpv6(v: string): boolean {
  if (!v.includes(":") || !IPV6.test(v)) return false;
  const doubles = v.split("::").length - 1;
  if (doubles > 1) return false;
  const groups = v.split(":").filter(Boolean);
  return groups.length <= 8 && groups.every((g) => g.includes(".") || g.length <= 4);
}

/** Works out what the smart search box holds, as the design's "one box for everything". */
export function detect(query: string): Detected {
  const v = query.trim();
  if (!v) return { label: "Anything", kind: null };
  const slash = v.indexOf("/");
  if (slash > 0) {
    const addr = v.slice(0, slash);
    const bits = v.slice(slash + 1);
    const max = IPV4.test(addr) ? 32 : isIpv6(addr) ? 128 : -1;
    if (max > 0 && /^\d{1,3}$/.test(bits) && Number(bits) <= max)
      return { label: "CIDR", kind: "CIDR" };
  }
  if (IPV4.test(v)) return { label: "IPv4", kind: "IPv4" };
  if (isIpv6(v)) return { label: "IPv6", kind: "IPv6" };
  if (/^as\d{1,10}$/i.test(v)) return { label: "ASN", kind: "ASN" };
  if (/^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(v))
    return { label: "Domain", kind: "Domain" };
  return { label: "Keep typing", kind: null };
}
