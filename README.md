# @dotquad/net

A typed client for the [Dotquad API](https://dotquad.app/docs/), plus the small network helpers every Dotquad client shares: query detection, subnet math, reserved ranges and grade tones.

The Dotquad website uses it, and so will each extension as it ships, so they all answer the same way. It has no dependencies and runs in browsers and in Node 22 and later.

## Install

```sh
npm install @dotquad/net
```

Not on npm yet. Until the first release, install it from GitHub:

```sh
npm install github:dotquad/net
```

## Use the API

You need an API key. A free one covers 30,000 requests a month: [dotquad.app/signup](https://dotquad.app/signup/).

```ts
import { createClient, DotquadError } from "@dotquad/net";

const dq = createClient({ key: process.env.DOTQUAD_KEY });

const me = await dq.me();
console.log(me.ip, me.location.city, me.network.org);
console.log(me.sources.network?.name); // where the network fields came from
```

Every method resolves to the endpoint's JSON, the same as `curl` and the MCP server return:

| Method                                                          | Endpoint                                   |
| --------------------------------------------------------------- | ------------------------------------------ |
| `ip(ip, { abuse? })`                                            | `GET /v1/ip/{ip}`                          |
| `me({ abuse? })`                                                | `GET /v1/me`                               |
| `batch(ips)`                                                    | `POST /v1/batch` (Starter plan and up)     |
| `asn(asn)`                                                      | `GET /v1/asn/{asn}`                        |
| `subnet(cidr, { splitPrefix? })`                                | `GET /v1/subnet/{cidr}`                    |
| `usage()`                                                       | `GET /v1/usage`                            |
| `dns(query)`, `whois(query)`, `dnssec(name)`, `tls(host)`       | `GET /v1/dns`, `/whois`, `/dnssec`, `/tls` |
| `email(domain, { selectors? })`, `check(domain)`                | `GET /v1/email`, `/check`                  |
| `link(url)`, `takeover(domain, { names? })`, `blacklist(query)` | `GET /v1/link`, `/takeover`, `/blacklist`  |
| `trace(target)`                                                 | `GET /v1/trace/{target}`                   |

`ip`, `me`, `batch`, `asn`, `subnet` and `usage` have full types. The other checks are typed as plain JSON objects for now; their fields are in the [API docs](https://dotquad.app/docs/).

## Errors

A failed call rejects with a `DotquadError` that says what to do:

```ts
try {
  await dq.batch(["8.8.8.8", "1.1.1.1"]);
} catch (err) {
  if (!(err instanceof DotquadError)) throw err;
  if (err.isQuotaExceeded) console.log(`Requests reset ${err.resetsAt}. More: ${err.upgradeUrl}`);
  else if (err.isRateLimited) console.log(`Try again in ${err.retryAfter} s`);
  else if (err.isPlanRequired) console.log(`Needs the ${err.plan} plan: ${err.upgradeUrl}`);
  else if (err.isInvalidKey) console.log("Check your API key");
  else console.log(err.status, err.code, err.message);
}
```

Dotquad never bills overages. When the month's requests are used up, the API answers `429` until the 1st.

## Helpers

```ts
import { detect, parseInput, calculate, rangeKind, gradeTone } from "@dotquad/net";

detect("10.0.0.0/22").kind; // "CIDR"
detect("AS13335").kind; // "ASN"

const block = calculate(parseInput("192.168.1.10/24")!);
rangeKind(block); // "Private (RFC 1918)"

gradeTone("B"); // "neutral": teal for A, grey for B and C, amber for D and F
```

## Options

| Option    | Default                      |                                                     |
| --------- | ---------------------------- | --------------------------------------------------- |
| `key`     | none                         | Your API key, sent as `Authorization: Bearer <key>` |
| `baseUrl` | `https://api.dotquad.app/v1` | Where the endpoints live                            |
| `fetch`   | the global `fetch`           | For tests, proxies or older runtimes                |

In browsers, requests go without cookies and without a referrer.

## Privacy

Dotquad keeps no logs of what you look up. Each key's monthly request count is the only thing recorded. [Privacy policy](https://dotquad.app/privacy/).

## License

MIT. The Dotquad service itself is closed source; this package is the client side.
