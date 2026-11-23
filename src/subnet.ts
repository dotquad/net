/**
 * Subnet math with BigInt, so IPv6's 128-bit ranges are exact. Shared by the subnet
 * calculator page (which runs it in the browser) and the MCP server's subnet tool.
 * Plain TypeScript with no imports, so it runs in both.
 */

export type Family = 4 | 6;

export interface Parsed {
  family: Family;
  /** The address as typed, as a number. */
  address: bigint;
  prefix: number;
}

const BITS: Record<Family, number> = { 4: 32, 6: 128 };

// ---------------------------------------------------------------------------
// Parsing

export function parseIPv4(text: string): bigint | null {
  const parts = text.split(".");
  if (parts.length !== 4) return null;
  let n = 0n;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p) || (p.length > 1 && p.startsWith("0"))) return null;
    const v = Number(p);
    if (v > 255) return null;
    n = (n << 8n) | BigInt(v);
  }
  return n;
}

export function parseIPv6(text: string): bigint | null {
  let s = text.toLowerCase();
  if (s.includes("%")) return null; // zone IDs aren't addresses
  // A trailing dotted IPv4 part (::ffff:192.0.2.1) becomes two groups.
  const v4 = s.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  if (v4) {
    const n = parseIPv4(v4[2]!);
    if (n === null) return null;
    s = `${v4[1]}${(n >> 16n).toString(16)}:${(n & 0xffffn).toString(16)}`;
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const groups = (part: string) => (part === "" ? [] : part.split(":"));
  const head = groups(halves[0]!);
  const tail = halves.length === 2 ? groups(halves[1]!) : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? head.length !== 8 : missing < 1) return null;
  const all = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill("0"), ...tail];
  let n = 0n;
  for (const g of all) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    n = (n << 16n) | BigInt(parseInt(g, 16));
  }
  return n;
}

/** A dotted netmask (255.255.255.0) as a prefix length, or null if it isn't a valid mask. */
export function maskToPrefix(mask: string): number | null {
  const n = parseIPv4(mask);
  if (n === null) return null;
  const bin = n.toString(2).padStart(32, "0");
  return /^1*0*$/.test(bin) ? (bin.indexOf("0") === -1 ? 32 : bin.indexOf("0")) : null;
}

/**
 * Reads what people type: "10.0.0.0/24", "2001:db8::/48", "192.168.1.10 255.255.255.0",
 * "192.168.1.10/255.255.255.0", or a bare address (/24 for IPv4, /64 for IPv6).
 */
export function parseInput(raw: string): Parsed | null {
  const text = raw.trim().replace(/\s+/g, " ");
  if (!text) return null;
  const m = text.match(/^([^\s/]+)(?:\s*\/\s*|\s+)?(\S+)?$/);
  if (!m) return null;
  const [, addrText, sizeText] = m;
  const v4 = parseIPv4(addrText!);
  const v6 = v4 === null ? parseIPv6(addrText!) : null;
  if (v4 === null && v6 === null) return null;
  const family: Family = v4 !== null ? 4 : 6;
  const address = (v4 ?? v6)!;
  let prefix: number | null;
  if (sizeText === undefined) prefix = family === 4 ? 24 : 64;
  else if (/^\d{1,3}$/.test(sizeText)) prefix = Number(sizeText);
  else if (family === 4) prefix = maskToPrefix(sizeText);
  else prefix = null;
  if (prefix === null || prefix < 0 || prefix > BITS[family]) return null;
  return { family, address, prefix };
}

// ---------------------------------------------------------------------------
// Formatting

export function formatIPv4(n: bigint): string {
  return [24n, 16n, 8n, 0n].map((s) => String((n >> s) & 255n)).join(".");
}

/** Every group written out: 2001:0db8:0000:…. */
export function expandIPv6(n: bigint): string {
  const groups: string[] = [];
  for (let i = 7; i >= 0; i--)
    groups.push(((n >> BigInt(i * 16)) & 0xffffn).toString(16).padStart(4, "0"));
  return groups.join(":");
}

/** RFC 5952 form: lower case, leading zeros dropped, the longest run of zero groups as "::". */
export function formatIPv6(n: bigint): string {
  const groups: number[] = [];
  for (let i = 7; i >= 0; i--) groups.push(Number((n >> BigInt(i * 16)) & 0xffffn));
  let best = { start: -1, len: 0 };
  for (let i = 0; i < 8;) {
    if (groups[i] !== 0) {
      i++;
      continue;
    }
    let j = i;
    while (j < 8 && groups[j] === 0) j++;
    if (j - i > best.len && j - i >= 2) best = { start: i, len: j - i };
    i = j;
  }
  const hex = groups.map((g) => g.toString(16));
  if (best.start === -1) return hex.join(":");
  const left = hex.slice(0, best.start).join(":");
  const right = hex.slice(best.start + best.len).join(":");
  return `${left}::${right}`;
}

export const formatAddress = (n: bigint, family: Family) =>
  family === 4 ? formatIPv4(n) : formatIPv6(n);

/** 16777216 → "16,777,216"; huge IPv6 counts as powers of two. */
export function formatCount(n: bigint, exponent: number): string {
  if (n < 10n ** 15n) return Number(n).toLocaleString("en-US");
  return `2^${exponent} (${Number(n).toExponential(2).replace("e+", " × 10^")})`;
}

// ---------------------------------------------------------------------------
// The calculation

export interface Subnet {
  family: Family;
  prefix: number;
  /** The address as typed, if it isn't the network address itself. */
  input: bigint;
  network: bigint;
  last: bigint;
  mask: bigint;
  total: bigint;
  /** Usable hosts: IPv4 leaves out the network and broadcast, except /31 (RFC 3021) and /32. */
  hosts: bigint;
  firstHost: bigint;
  lastHost: bigint;
}

export function calculate({ family, address, prefix }: Parsed): Subnet {
  const bits = BigInt(BITS[family]);
  const all = (1n << bits) - 1n;
  const hostBits = bits - BigInt(prefix);
  const mask = (all << hostBits) & all;
  const network = address & mask;
  const total = 1n << hostBits;
  const last = network + total - 1n;
  let firstHost = network;
  let lastHost = last;
  let hosts = total;
  if (family === 4 && prefix < 31) {
    firstHost = network + 1n;
    lastHost = last - 1n;
    hosts = total - 2n;
  }
  return { family, prefix, input: address, network, last, mask, total, hosts, firstHost, lastHost };
}

/** 255.255.255.0 → 0.0.0.255 (the inverse mask used in ACLs and OSPF). */
export const wildcard = (s: Subnet) => ((1n << BigInt(BITS[s.family])) - 1n) ^ s.mask;

/** Dotted binary of an IPv4 number: "11000000.10101000.00000001.00000000". */
export function binaryIPv4(n: bigint): string {
  return n
    .toString(2)
    .padStart(32, "0")
    .replace(/(.{8})(?!$)/g, "$1.");
}

/** The dotted binary split into its network bits and host bits, for highlighting. */
export function binaryParts(n: bigint, prefix: number): [string, string] {
  const dotted = binaryIPv4(n);
  // Bit i sits at character i + floor(i / 8), counting the dots before it.
  const at = Math.min(dotted.length, prefix + Math.floor(prefix / 8));
  return [dotted.slice(0, at), dotted.slice(at)];
}

/** The smaller subnets a block splits into at `newPrefix` (the first `limit` of them). */
export function split(
  s: Subnet,
  newPrefix: number,
  limit = 64,
): { count: bigint; subnets: bigint[] } {
  const bits = BITS[s.family];
  if (newPrefix <= s.prefix || newPrefix > bits) return { count: 0n, subnets: [] };
  const count = 1n << BigInt(newPrefix - s.prefix);
  const step = 1n << BigInt(bits - newPrefix);
  const subnets: bigint[] = [];
  for (let i = 0n; i < count && i < BigInt(limit); i++) subnets.push(s.network + i * step);
  return { count, subnets };
}

// ---------------------------------------------------------------------------
// What kind of range it is (IPv4 RFC 6890 essentials, plus the common IPv6 ones)

const V4_RANGES: [string, number, string][] = [
  ["0.0.0.0", 8, "This network (RFC 1122)"],
  ["10.0.0.0", 8, "Private (RFC 1918)"],
  ["100.64.0.0", 10, "Carrier-grade NAT (RFC 6598)"],
  ["127.0.0.0", 8, "Loopback"],
  ["169.254.0.0", 16, "Link-local"],
  ["172.16.0.0", 12, "Private (RFC 1918)"],
  ["192.0.2.0", 24, "Documentation (TEST-NET-1)"],
  ["192.168.0.0", 16, "Private (RFC 1918)"],
  ["198.18.0.0", 15, "Benchmarking (RFC 2544)"],
  ["198.51.100.0", 24, "Documentation (TEST-NET-2)"],
  ["203.0.113.0", 24, "Documentation (TEST-NET-3)"],
  ["224.0.0.0", 4, "Multicast"],
  ["240.0.0.0", 4, "Reserved"],
];
const V6_RANGES: [string, number, string][] = [
  ["::1", 128, "Loopback"],
  ["::ffff:0:0", 96, "IPv4-mapped"],
  ["64:ff9b::", 96, "IPv4/IPv6 translation (NAT64)"],
  ["2001:db8::", 32, "Documentation"],
  ["fc00::", 7, "Unique local (private)"],
  ["fe80::", 10, "Link-local"],
  ["ff00::", 8, "Multicast"],
];

/** The special-purpose range a block falls in, or "Public" when it's ordinary global space. */
export function rangeKind(s: Subnet): string {
  const table = s.family === 4 ? V4_RANGES : V6_RANGES;
  const bits = BigInt(BITS[s.family]);
  for (const [addr, len, label] of table) {
    const base = s.family === 4 ? parseIPv4(addr)! : parseIPv6(addr)!;
    if (s.prefix < len) continue; // the block is bigger than the range
    const mask = ((1n << bits) - 1n) ^ ((1n << (bits - BigInt(len))) - 1n);
    if ((s.network & mask) === base) return label;
  }
  if (s.family === 6 && s.network >> 125n !== 1n) return "Not global unicast";
  return "Public";
}
