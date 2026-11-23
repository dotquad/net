/** Response shapes of the Dotquad API (https://dotquad.app/docs/). */

/** Where one group of fields came from. `updated` is the data set's build date; null for live checks. */
export interface FieldSource {
  name: string;
  license: string | null;
  updated: string | null;
}

/** `GET /v1/ip/{ip}` and `GET /v1/me`. */
export interface Lookup {
  ip: string;
  version: 4 | 6;
  hostname: string | null;
  location: {
    city: string | null;
    region: string | null;
    country: string | null;
    postal: string | null;
    latitude: number | null;
    longitude: number | null;
    timezone: string | null;
    accuracy_km: number | null;
  };
  network: {
    asn: number | null;
    org: string | null;
    prefix: string | null;
    type: string;
    /** The registry's abuse contact, only when asked for with `abuse: true`. */
    abuse?: string | null;
  };
  /** Privacy detection (beta): on the Starter plan and up; null on Free. */
  privacy: {
    vpn: boolean;
    proxy: boolean;
    tor: boolean;
    hosting: boolean;
    provider: string | null;
  } | null;
  sources: {
    location: FieldSource | null;
    country: FieldSource | null;
    timezone: FieldSource | null;
    network: FieldSource | null;
    hostname: FieldSource | null;
    privacy: FieldSource | null;
    abuse?: FieldSource | null;
  };
}

/** One slot of `POST /v1/batch`: the lookup, or that address's error. */
export type BatchItem =
  Lookup | { ip: string; error: { code: string; message: string; range?: string } };

/** `GET /v1/asn/{asn}`. */
export interface AsnInfo {
  asn: number;
  org: string | null;
  domain: string | null;
  country: string | null;
  prefixes: { ipv4: string[]; ipv6: string[] };
}

/** `GET /v1/subnet/{cidr}`. Counts too big to be exact JSON numbers come as decimal strings. */
export interface SubnetAnswer {
  cidr: string;
  version: 4 | 6;
  prefix: number;
  address: string;
  network: string;
  last_address: string;
  netmask: string;
  /** IPv4 only. */
  wildcard?: string;
  /** IPv4 only; null for /31 and /32. */
  broadcast?: string | null;
  first_host: string;
  last_host: string;
  total_addresses: number | string;
  usable_hosts: number | string;
  kind: string;
  split?: { prefix: number; count: number | string; subnets: string[]; truncated: boolean };
}

/** `GET /v1/usage`. API usage is counted in requests. */
export interface Usage {
  plan: "free" | "starter" | "pro" | "business";
  period: string;
  requests_used: number;
  requests_quota: number;
  requests_remaining: number;
  resets_at: string;
  requests_per_second: number;
  traces_per_hour: number;
  traces: { used: number; limit: number; remaining: number; resets_at: string };
}

/**
 * The other checks (DNS, WHOIS, DNSSEC, TLS, email, the report card, links, takeovers,
 * blacklists, traceroute) return JSON documented at https://dotquad.app/docs/. They're
 * typed loosely here for now.
 */
export type JsonObject = { [key: string]: unknown };
