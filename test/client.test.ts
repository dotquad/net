import { describe, expect, it } from "vitest";
import { createClient, DotquadError } from "../src";

interface Seen {
  url: string;
  init: RequestInit;
}

/** A fetch that records each request and answers with the given status, body and headers. */
function fakeFetch(status: number, body: unknown, headers: Record<string, string> = {}) {
  const seen: Seen[] = [];
  const fetch = (async (url: string, init: RequestInit) => {
    seen.push({ url, init });
    return new Response(typeof body === "string" ? body : JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json", ...headers },
    });
  }) as unknown as typeof globalThis.fetch;
  return { fetch, seen };
}

describe("createClient", () => {
  it("calls the public API with the key and returns the JSON", async () => {
    const { fetch, seen } = fakeFetch(200, { ip: "8.8.8.8", version: 4 });
    const dq = createClient({ key: "dq_live_test", fetch });
    const res = await dq.ip("8.8.8.8", { abuse: true });
    expect(res.ip).toBe("8.8.8.8");
    expect(seen[0]!.url).toBe("https://api.dotquad.app/v1/ip/8.8.8.8?abuse=true");
    const headers = seen[0]!.init.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer dq_live_test");
    expect(seen[0]!.init.method).toBe("GET");
    expect(seen[0]!.init.referrerPolicy).toBe("no-referrer");
  });

  it("builds every path and query the API documents", async () => {
    const { fetch, seen } = fakeFetch(200, {});
    const dq = createClient({ key: "k", baseUrl: "http://localhost:8080/v1/", fetch });
    await dq.me();
    await dq.asn("AS13335");
    await dq.subnet("10.0.0.0/24", { splitPrefix: 26 });
    await dq.email("example.com", { selectors: ["s1", "google"] });
    await dq.takeover("example.com", { names: ["www", "shop"] });
    await dq.link("https://example.com/a?b=c");
    await dq.batch(["8.8.8.8", "1.1.1.1"]);
    expect(seen.map((s) => s.url)).toEqual([
      "http://localhost:8080/v1/me",
      "http://localhost:8080/v1/asn/AS13335",
      "http://localhost:8080/v1/subnet/10.0.0.0%2F24?split_prefix=26",
      "http://localhost:8080/v1/email/example.com?selectors=s1%2Cgoogle",
      "http://localhost:8080/v1/takeover/example.com?names=www%2Cshop",
      "http://localhost:8080/v1/link?url=https%3A%2F%2Fexample.com%2Fa%3Fb%3Dc",
      "http://localhost:8080/v1/batch",
    ]);
    expect(seen.at(-1)!.init.method).toBe("POST");
    expect(seen.at(-1)!.init.body).toBe('{"ips":["8.8.8.8","1.1.1.1"]}');
  });

  it("sends no Authorization header without a key", async () => {
    const { fetch, seen } = fakeFetch(200, {});
    await createClient({ baseUrl: "https://api.dotquad.app/site", fetch }).me();
    expect(seen[0]!.url).toBe("https://api.dotquad.app/site/me");
    expect((seen[0]!.init.headers as Record<string, string>).authorization).toBeUndefined();
  });
});

describe("DotquadError", () => {
  const fail = async (status: number, error: unknown, headers?: Record<string, string>) => {
    const { fetch } = fakeFetch(status, error, headers);
    try {
      await createClient({ key: "k", fetch }).usage();
    } catch (err) {
      return err as DotquadError;
    }
    throw new Error("expected a rejection");
  };

  it("explains a used-up monthly quota", async () => {
    const err = await fail(
      429,
      {
        error: {
          code: "rate_limited",
          message: "Monthly request quota used.",
          reason: "quota",
          resets_at: "2026-12-01T00:00:00.000Z",
          upgrade_url: "https://dotquad.app/pricing/",
        },
      },
      { "retry-after": "3600" },
    );
    expect(err).toBeInstanceOf(DotquadError);
    expect(err.isQuotaExceeded).toBe(true);
    expect(err.isRateLimited).toBe(false);
    expect(err.resetsAt).toBe("2026-12-01T00:00:00.000Z");
    expect(err.upgradeUrl).toBe("https://dotquad.app/pricing/");
    expect(err.retryAfter).toBe(3600);
    expect(err.message).toBe("Monthly request quota used.");
  });

  it("tells a per-second limit apart from the quota", async () => {
    const err = await fail(
      429,
      { error: { code: "rate_limited", message: "Slow down.", reason: "per_second" } },
      { "retry-after": "1" },
    );
    expect(err.isRateLimited).toBe(true);
    expect(err.isQuotaExceeded).toBe(false);
  });

  it("names the plan a paid endpoint needs", async () => {
    const err = await fail(403, {
      error: {
        code: "plan_required",
        message: "Batch lookups need the Starter plan or higher.",
        plan: "starter",
        upgrade_url: "https://dotquad.app/pricing/",
      },
    });
    expect(err.isPlanRequired).toBe(true);
    expect(err.plan).toBe("starter");
  });

  it("reports a bad key, an unreadable answer and an unreachable API", async () => {
    expect((await fail(401, { error: { code: "invalid_key", message: "x" } })).isInvalidKey).toBe(
      true,
    );
    const html = await fail(502, "<html>Bad gateway</html>");
    expect(html.code).toBe("unexpected_response");
    const down = createClient({
      fetch: (async () => {
        throw new TypeError("fetch failed");
      }) as unknown as typeof fetch,
    });
    await expect(down.me()).rejects.toMatchObject({ status: 0, code: "network_error" });
  });
});
