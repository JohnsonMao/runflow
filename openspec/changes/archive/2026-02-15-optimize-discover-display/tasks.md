## 1. Catalog: add source (file | openapi)

- [x] 1.1 Add `source: 'file' | 'openapi'` to DiscoverEntry type and set it in buildDiscoverCatalog (file flows → file, OpenAPI flows → openapi)
- [x] 1.2 Ensure getDiscoverCatalog returns entries with source; no change to catalog build timing or invalidation

## 2. Tool: executor_flow (rename from execute)

- [x] 2.1 Register tool name `executor_flow` with same inputSchema (flowId, params) and updated description; handler delegates to existing execute logic
- [x] 2.2 Remove registration of tool `execute`

## 3. Tool: discover_flow_list

- [x] 3.1 Implement discover_flow_list handler: same catalog + keyword/limit/offset as current discover; output = Markdown table with columns flowId | name | type (use entry.source)
- [x] 3.2 Add pagination hint line when offset + limit < total (e.g. 下一批：使用 discover_flow_list(offset=N) 取得第 M–K 筆)
- [x] 3.3 Register tool name `discover_flow_list` with inputSchema (keyword, limit, offset); remove registration of tool `discover`

## 4. Tool: discover_flow_detail

- [x] 4.1 Implement discover_flow_detail handler: required param flowId; lookup catalog by flowId; if not found return short error Markdown; if found return Markdown with name, description, params (reuse formatParamsSummary / formatOneParam)
- [x] 4.2 Register tool name `discover_flow_detail` with inputSchema (flowId required)

## 5. Tests and descriptors

- [x] 5.1 Update mcp-server unit tests: replace references to `execute` with `executor_flow`, `discover` with `discover_flow_list`; add tests for discover_flow_detail (found / not found); assert list output is table with type column and pagination hint when applicable
- [x] 5.2 Update MCP tool descriptor(s) under mcps/ if they reference tool names (e.g. user-runflow-mcp tools) so clients see discover_flow_list, discover_flow_detail, executor_flow
