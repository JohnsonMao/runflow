## 1. Types and contract

- [x] 1.1 Add optional path, query, cookie to FlowStep in packages/core (types.ts or JSDoc) so http step shape is explicit; FlowStep already has [key: string]: unknown, so implementation can proceed without this if preferred

## 2. Http handler: URL assembly

- [x] 2.1 In packages/handlers http.ts, build final URL: when step.path is present, use step.url origin (protocol + host + port) plus step.path as pathname; when step.path is absent, keep current behavior (use step.url as-is)
- [x] 2.2 When step.query is present: if string, use as search part (no leading ?); if Record<string, string>, serialize to application/x-www-form-urlencoded and set as search; replace url’s existing search when step.query is set
- [x] 2.3 When step.cookie is present: if string, set Cookie header to that value; if Record<string, string>, serialize to key=value; key2=value2 (; separated); when both step.headers['Cookie'] and step.cookie exist, step.cookie takes precedence

## 3. Tests

- [x] 3.1 Add unit tests for http handler: path replaces pathname (e.g. url + path → final URL)
- [x] 3.2 Add unit tests for http handler: query as object and as string produces correct search
- [x] 3.3 Add unit tests for http handler: cookie sets/overrides Cookie header; cookie wins over headers['Cookie'] when both set
