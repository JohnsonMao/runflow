# Tasks: discover-flows-openapi-cache-markdown

## 1. Build discover catalog (cache)

- [x] 1.1 Add a function that, given config + configDir, builds the discover catalog: (a) use findFlowFiles(baseDir, ['.yaml'], ...) and loadFromFile for each file; (b) for each config.openapi prefix, resolve specPath and call openApiToFlows(specPath, { output: 'memory', ...entry options }); (c) merge into a single list of entries with { flowId, name, description?, params? } (file flowId = path relative to baseDir or absolute; OpenAPI flowId = `${prefix}-${operationKey}`).
- [x] 1.2 Cache the catalog in memory (e.g. same lifecycle as cachedConfig; build on first discover or when config is loaded). No invalidation for this change (process lifetime).

## 2. Discover tool uses catalog and keyword/limit

- [x] 2.1 Change discoverTool to obtain the catalog (from cache), filter by keyword (case-insensitive on flowId, name, description), apply limit, then format result as Markdown instead of JSON.
- [x] 2.2 Ensure keyword and limit parameters still work; when no flows match, return a short Markdown message (e.g. "No flows found.").

## 3. Markdown output with flowId, name, description, params

- [x] 3.1 Format each catalog entry as a row: flowId, name, description, params summary. Params summary: from flow.params (ParamDeclaration[]); display e.g. "name (type)[, required]" or a simple list; omit when empty.
- [x] 3.2 Output a Markdown table (e.g. | flowId | name | description | params |) with one row per flow (up to limit). Use a consistent format.

## 4. Tests and docs

- [x] 4.1 Add or update tests: discover returns both file and OpenAPI flows when config has both; discover with keyword filters correctly; discover result is Markdown and includes params when flow has params.
- [x] 4.2 Update apps/mcp-server README (if present) to describe discover output (Markdown, flowId/name/description/params) and that it includes OpenAPI-derived flows from config.
