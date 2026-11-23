import type { BatchItem, JsonObject, Lookup, Usage } from "./types";

export const DEFAULT_BASE_URL = "https://api.dotquad.app/v1";

export interface ClientOptions {
  /** Your Dotquad API key. A free one works: https://dotquad.app/signup/ */
  key?: string;
  /** Where the endpoints live, without a trailing slash. Defaults to https://api.dotquad.app/v1. */
  baseUrl?: string;
  /** A fetch to use instead of the global one (tests, proxies, older runtimes). */
  fetch?: typeof fetch;
}

/** An error answer from the API, with the fields that say what to do about it. */
export class DotquadError extends Error {
  /** HTTP status. 0 when the API couldn't be reached. */
  readonly status: number;
  /** The API's error code, such as `rate_limited`, `plan_required` or `invalid_key`. */
  readonly code: string;
  /** On `rate_limited`: `per_second` or `quota`. */
  readonly reason: string | null;
  /** Seconds to wait before trying again, from `Retry-After`. */
  readonly retryAfter: number | null;
  /** On a quota 429: when this month's quota resets (ISO 8601). */
  readonly resetsAt: string | null;
  /** On a quota 429 or `plan_required`: the pricing page. */
  readonly upgradeUrl: string | null;
  /** On `plan_required`: the cheapest plan that includes the feature. */
  readonly plan: string | null;
  /** Every field of the error as the API sent it. */
  readonly details: JsonObject;

  constructor(status: number, details: JsonObject, retryAfter: number | null = null) {
    super(typeof details.message === "string" ? details.message : `Dotquad API error ${status}`);
    this.name = "DotquadError";
    this.status = status;
    this.details = details;
    const str = (k: string) => (typeof details[k] === "string" ? (details[k] as string) : null);
    this.code = str("code") ?? "unknown_error";
    this.reason = str("reason");
    this.resetsAt = str("resets_at");
    this.upgradeUrl = str("upgrade_url");
    this.plan = str("plan");
    this.retryAfter = retryAfter;
  }

  /** The month's requests are used up. They come back at `resetsAt`; nothing is billed. */
  get isQuotaExceeded(): boolean {
    return this.status === 429 && this.reason === "quota";
  }

  /** Too many requests this second. Wait `retryAfter` seconds. */
  get isRateLimited(): boolean {
    return this.status === 429 && this.reason !== "quota";
  }

  /** The key's plan doesn't include this endpoint. `plan` names one that does. */
  get isPlanRequired(): boolean {
    return this.code === "plan_required";
  }

  /** The key is missing, wrong or revoked. */
  get isInvalidKey(): boolean {
    return this.code === "invalid_key";
  }
}

const seg = encodeURIComponent;
const query = (params: Record<string, string | undefined>) => {
  const q = Object.entries(params)
    .filter((e): e is [string, string] => e[1] !== undefined && e[1] !== "")
    .map(([k, v]) => `${k}=${seg(v)}`)
    .join("&");
  return q ? `?${q}` : "";
};

/**
 * A client for the Dotquad API, covering what Dotquad's browser, VS Code and Raycast
 * extensions call. Every method resolves to the endpoint's JSON and rejects with a
 * `DotquadError` when the API answers with an error.
 *
 * ```ts
 * const dq = createClient({ key: process.env.DOTQUAD_KEY });
 * const me = await dq.me();
 * ```
 */
export function createClient(options: ClientOptions = {}) {
  const base = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis);

  async function call<T>(path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { accept: "application/json" };
    if (options.key) headers.authorization = `Bearer ${options.key}`;
    if (body !== undefined) headers["content-type"] = "application/json";
    let res: Response;
    try {
      res = await doFetch(base + path, {
        method: body === undefined ? "GET" : "POST",
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        // Browsers: the API never learns which page asked, and no cookies are sent.
        referrerPolicy: "no-referrer",
        credentials: "omit",
      });
    } catch (err) {
      throw new DotquadError(0, {
        code: "network_error",
        message: "Couldn't reach the Dotquad API. Check your connection and try again.",
        cause: String(err),
      });
    }
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      // Not JSON: reported below as an error with the text.
    }
    if (res.ok && json !== null) return json as T;
    const error =
      json && typeof json === "object" && "error" in json && typeof json.error === "object"
        ? (json.error as JsonObject)
        : { code: "unexpected_response", message: text.slice(0, 200) || res.statusText };
    const retry = Number(res.headers.get("retry-after"));
    throw new DotquadError(res.status, error, Number.isFinite(retry) && retry > 0 ? retry : null);
  }

  return {
    /** Location, network, hostname, time zone and sources for an address. */
    ip: (ip: string, opts: { abuse?: boolean } = {}) =>
      call<Lookup>(`/ip/${seg(ip)}${opts.abuse ? "?abuse=true" : ""}`),
    /** The same lookup for the address making the request. */
    me: (opts: { abuse?: boolean } = {}) => call<Lookup>(`/me${opts.abuse ? "?abuse=true" : ""}`),
    /** Up to 100 addresses at once, in order. Starter plan and up. */
    batch: (ips: string[]) => call<{ results: BatchItem[] }>("/batch", { ips }),
    /** Your plan and this month's usage. Doesn't count as a request. */
    usage: () => call<Usage>("/usage"),
    dns: (q: string) => call<JsonObject>(`/dns/${seg(q)}`),
    whois: (q: string) => call<JsonObject>(`/whois/${seg(q)}`),
    tls: (host: string) => call<JsonObject>(`/tls/${seg(host)}`),
    email: (domain: string, opts: { selectors?: string[] } = {}) =>
      call<JsonObject>(`/email/${seg(domain)}${query({ selectors: opts.selectors?.join(",") })}`),
    /** The domain report card, graded A+ to F. */
    check: (domain: string) => call<JsonObject>(`/check/${seg(domain)}`),
    link: (url: string) => call<JsonObject>(`/link${query({ url })}`),
    takeover: (domain: string, opts: { names?: string[] } = {}) =>
      call<JsonObject>(`/takeover/${seg(domain)}${query({ names: opts.names?.join(",") })}`),
  };
}

export type DotquadClient = ReturnType<typeof createClient>;
