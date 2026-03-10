# flow-id-normalization Specification

## Purpose

TBD - created by archiving change 'normalize-flow-ids-and-validate-duplicates'. Update Purpose after archive.

## Requirements

### Requirement: The system SHALL provide a Flow ID normalization function

The system SHALL expose a normalization function that accepts a Flow ID string and SHALL return a normalized Flow ID string. The normalization function SHALL:
1. Decode URL-encoded characters (e.g., `%2F` → `/`, `%3A` → `:`)
2. Convert all special characters to underscore `_`, except hyphens `-`, underscores `_`, and dots `.` which SHALL be preserved
3. Collapse consecutive underscores into a single underscore
4. Remove leading and trailing underscores

#### Scenario: URL-encoded characters are decoded and normalized

- **WHEN** a Flow ID contains URL-encoded characters such as `tt%2Fpost-users.yaml` or `scm%3Apost-scm-V1-Category-GetCategory`
- **THEN** the normalization function SHALL decode them first (e.g., `%2F` → `/`, `%3A` → `:`)
- **AND** SHALL then convert the decoded special characters to underscores, resulting in `tt_post-users.yaml` and `scm_post-scm-V1-Category-GetCategory` respectively

#### Scenario: Valid characters are preserved

- **WHEN** a Flow ID contains hyphens `-`, underscores `_`, or dots `.`
- **THEN** these characters SHALL be preserved as-is in the normalized ID
- **AND** other special characters (e.g., `/`, `:`, `%`, spaces) SHALL be converted to underscores

#### Scenario: Consecutive underscores are collapsed

- **WHEN** normalization produces consecutive underscores (e.g., `get__users` or `api___call`)
- **THEN** the normalization function SHALL collapse them into a single underscore (e.g., `get_users`, `api_call`)

#### Scenario: Leading and trailing underscores are removed

- **WHEN** normalization produces a Flow ID with leading or trailing underscores (e.g., `_get-users` or `get-users_`)
- **THEN** the normalization function SHALL remove them, resulting in `get-users`

#### Scenario: Invalid URL encoding is handled gracefully

- **WHEN** a Flow ID contains invalid URL-encoded characters that cause `decodeURIComponent` to throw an error
- **THEN** the normalization function SHALL catch the error and SHALL skip the decoding step for that ID
- **AND** SHALL continue with the normalization process using the original string


<!-- @trace
source: normalize-flow-ids-and-validate-duplicates
updated: 2026-03-09
code:
  - packages/viewer/src/flowDefinitionToGraph.ts
  - apps/flow-viewer/src/flowGraphToReactFlow.ts
  - packages/convention-openapi/src/collectOperations.ts
  - apps/flow-viewer/src/flowDefinitionToGraph.ts
  - packages/viewer/src/layout.ts
  - apps/cli/.runflow/runs/latest.json
  - packages/core/src/engine.ts
  - apps/flow-viewer/src/components/FlowCanvas.tsx
  - apps/flow-viewer/src/index.css
  - apps/flow-viewer/src/components/FlowSidebar.tsx
  - packages/viewer/src/components/ResultDialog.tsx
  - apps/flow-viewer/components.json
  - workspace/config/runflow.config.json
  - apps/flow-viewer/src/components/ParamsSheet.tsx
  - packages/viewer/src/components/ui/dialog.tsx
  - apps/flow-viewer/src/components/ui/switch.tsx
  - apps/cli/src/cli.test-utils.ts
  - apps/flow-viewer/src/components/ui/button.tsx
  - packages/convention-openapi/src/writeFlows.ts
  - apps/flow-viewer/src/components/ui/collapsible.tsx
  - packages/viewer/vitest.config.ts
  - packages/viewer/src/components/ui/input.tsx
  - workspace/custom-handler/logistics-center-handler.mjs
  - packages/core/src/types.ts
  - packages/convention-openapi/src/types.ts
  - packages/viewer/src/components/ui/switch.tsx
  - packages/viewer/src/components/ui/button.tsx
  - packages/viewer/src/components/ui/sheet.tsx
  - packages/viewer/tsconfig.json
  - apps/flow-viewer/tsconfig.json
  - packages/viewer/src/flowGraphToReactFlow.ts
  - packages/viewer/src/types.ts
  - packages/viewer/src/hooks/use-websocket.ts
  - packages/viewer/src/index.css
  - apps/flow-viewer/src/App.tsx
  - apps/flow-viewer/src/lib/params.ts
  - apps/flow-viewer/src/components/ui/tooltip.tsx
  - packages/viewer/tsup.config.ts
  - packages/viewer/src/components/ui/separator.tsx
  - apps/flow-viewer/server/index.ts
  - packages/core/src/substitute.ts
  - apps/flow-viewer/src/components/FlowMainContent.tsx
  - workspace/custom-handler/payments-handler.mjs
  - apps/cli/src/cli.ts
  - packages/viewer/components.json
  - apps/flow-viewer/src/components/ui/sidebar.tsx
  - packages/workspace/src/index.ts
  - apps/flow-viewer/src/hooks/use-flow-graph.ts
  - packages/viewer/src/components/FlowHeader.tsx
  - packages/viewer/src/hooks/use-workspace.ts
  - packages/viewer/package.json
  - packages/viewer/src/components/ui/collapsible.tsx
  - packages/core/src/handler-factory.ts
  - packages/handlers/src/command.ts
  - apps/cli/package.json
  - apps/flow-viewer/src/types.ts
  - packages/viewer/src/hooks/use-flow-graph.ts
  - packages/convention-openapi/src/openApiToFlows.ts
  - workspace/custom-handler/txn-token-handler.mjs
  - workspace/src/logisticsCenter.ts
  - workspace/flows/tt/test.yaml
  - packages/viewer/src/components/FlowCanvas.tsx
  - apps/flow-viewer/src/components/ui/dialog.tsx
  - apps/flow-viewer/src/components/ui/input.tsx
  - packages/viewer/src/lib/params.ts
  - packages/core/src/safeExpression.ts
  - packages/core/src/utils.ts
  - eslint.config.mjs
  - packages/workspace/src/format.ts
  - packages/viewer/server/lib/index.ts
  - apps/flow-viewer/vite.config.ts
  - README.md
  - apps/flow-viewer/src/components/ui/skeleton.tsx
  - packages/viewer/src/lib/nested.ts
  - apps/flow-viewer/src/components/ui/card.tsx
  - apps/mcp-server/src/tools.ts
  - packages/viewer/src/components/ui/tooltip.tsx
  - packages/viewer/src/components/FlowSidebar.tsx
  - packages/viewer/src/components/ui/select.tsx
  - packages/viewer/src/hooks/use-mobile.ts
  - packages/viewer/src/components/ui/card.tsx
  - apps/mcp-server/src/index.ts
  - packages/viewer/src/components/ParamsSheet.tsx
  - apps/flow-viewer/src/lib/nested.ts
  - packages/viewer/src/main.tsx
  - apps/flow-viewer/src/components/ResultDialog.tsx
  - packages/viewer/src/components/ui/tabs.tsx
  - apps/flow-viewer/server/workspace-api.ts
  - ARCHITECTURAL_REFORM.md
  - packages/workspace/src/snapshot.ts
  - apps/flow-viewer/src/components/ui/separator.tsx
  - packages/viewer/src/components/ParamsForm.tsx
  - apps/flow-viewer/src/components/ui/sheet.tsx
  - packages/handlers/src/sleep.ts
  - workspace/src/promotionRules.ts
  - packages/viewer/src/components/FlowMainContent.tsx
  - apps/flow-viewer/src/components/ParamsForm.tsx
  - workspace/custom-handler/scm-handler.mjs
  - packages/viewer/src/App.tsx
  - apps/flow-viewer/src/layout.ts
  - packages/viewer/vite.config.ts
  - apps/flow-viewer/package.json
  - workspace/custom-handler/promotion-rules-handler.mjs
  - apps/cli/src/dev.ts
  - packages/viewer/server/workspace-api.ts
  - workspace/custom-handler/txn-last-token-handler.mjs
  - packages/viewer/server/index.ts
  - apps/mcp-server/src/fixtures/.runflow/runs/latest.json
  - workspace/config/.runflow/runs/latest.json
  - apps/flow-viewer/src/hooks/use-theme.ts
  - apps/flow-viewer/src/hooks/use-mobile.ts
  - packages/viewer/index.html
  - packages/core/src/index.ts
  - packages/viewer/src/hooks/use-theme.ts
  - packages/workspace/src/discover.ts
  - packages/viewer/src/components/ui/skeleton.tsx
  - apps/flow-viewer/index.html
  - apps/flow-viewer/src/components/FlowHeader.tsx
  - packages/handlers/src/http.ts
  - apps/flow-viewer/vitest.config.ts
  - apps/flow-viewer/src/lib/utils.ts
  - packages/viewer/src/lib/utils.ts
  - packages/viewer/src/components/ui/sidebar.tsx
  - apps/flow-viewer/src/main.tsx
  - packages/workspace/src/config.ts
  - apps/flow-viewer/src/hooks/use-workspace.ts
  - packages/handlers/src/index.ts
  - apps/flow-viewer/src/components/ui/select.tsx
  - pnpm-workspace.yaml
tests:
  - apps/cli/src/cli.validate.test.ts
  - packages/handlers/src/http.test.ts
  - packages/core/src/substitute.test.ts
  - packages/handlers/src/sleep.test.ts
  - packages/convention-openapi/src/collectOperations.test.ts
  - packages/viewer/src/flowGraphToReactFlow.test.ts
  - packages/workspace/src/format.test.ts
  - apps/mcp-server/src/tools.test.ts
  - packages/convention-openapi/src/writeFlows.test.ts
  - packages/viewer/src/layout.test.ts
  - packages/viewer/src/flowDefinitionToGraph.test.ts
  - apps/cli/src/cli.inspect.test.ts
  - packages/workspace/src/discover.test.ts
  - apps/cli/src/cli.run.test.ts
  - packages/viewer/server/workspace-api.test.ts
  - apps/flow-viewer/src/flowGraphToReactFlow.test.ts
  - apps/flow-viewer/server/workspace-api.test.ts
  - packages/core/src/utils.test.ts
  - packages/core/src/safeExpression.test.ts
  - apps/flow-viewer/src/flowDefinitionToGraph.test.ts
  - packages/core/src/engine.test.ts
  - packages/core/src/hooks.test.ts
  - packages/core/src/hooks_v2.test.ts
  - apps/flow-viewer/src/layout.test.ts
-->

---
### Requirement: Flow IDs SHALL be normalized during catalog discovery

When building the discover catalog, the system SHALL normalize all Flow IDs before storing them in the catalog and before performing duplicate validation. This SHALL apply to:
1. Flow IDs from Flow YAML files (from the `id` field or file path)
2. Flow IDs from OpenAPI handlers (format: `handlerKey:operationKey`)

#### Scenario: Flow YAML IDs are normalized during catalog discovery

- **WHEN** `buildDiscoverCatalog` processes a Flow YAML file with an `id` field containing special characters (e.g., `id: tt%2Fpost-users.yaml`)
- **THEN** the catalog entry SHALL use the normalized ID (e.g., `tt_post-users.yaml`)
- **AND** the original ID SHALL be preserved for error reporting if needed

#### Scenario: OpenAPI handler Flow IDs are normalized during catalog discovery

- **WHEN** `buildDiscoverCatalog` processes OpenAPI handlers and generates Flow IDs in the format `handlerKey:operationKey`
- **THEN** the entire Flow ID string SHALL be normalized (e.g., `scm:post-scm-V1-Category-GetCategory` → `scm_post-scm-V1-Category-GetCategory`)
- **AND** the normalized ID SHALL be used in the catalog entry

#### Scenario: File path-based IDs are normalized

- **WHEN** a Flow YAML file has no `id` field and the system uses the relative file path as the Flow ID (e.g., `tt/post-users.yaml`)
- **THEN** the path SHALL be normalized (e.g., `tt_post-users.yaml`)
- **AND** the normalized ID SHALL be used in the catalog entry


<!-- @trace
source: normalize-flow-ids-and-validate-duplicates
updated: 2026-03-09
code:
  - packages/viewer/src/flowDefinitionToGraph.ts
  - apps/flow-viewer/src/flowGraphToReactFlow.ts
  - packages/convention-openapi/src/collectOperations.ts
  - apps/flow-viewer/src/flowDefinitionToGraph.ts
  - packages/viewer/src/layout.ts
  - apps/cli/.runflow/runs/latest.json
  - packages/core/src/engine.ts
  - apps/flow-viewer/src/components/FlowCanvas.tsx
  - apps/flow-viewer/src/index.css
  - apps/flow-viewer/src/components/FlowSidebar.tsx
  - packages/viewer/src/components/ResultDialog.tsx
  - apps/flow-viewer/components.json
  - workspace/config/runflow.config.json
  - apps/flow-viewer/src/components/ParamsSheet.tsx
  - packages/viewer/src/components/ui/dialog.tsx
  - apps/flow-viewer/src/components/ui/switch.tsx
  - apps/cli/src/cli.test-utils.ts
  - apps/flow-viewer/src/components/ui/button.tsx
  - packages/convention-openapi/src/writeFlows.ts
  - apps/flow-viewer/src/components/ui/collapsible.tsx
  - packages/viewer/vitest.config.ts
  - packages/viewer/src/components/ui/input.tsx
  - workspace/custom-handler/logistics-center-handler.mjs
  - packages/core/src/types.ts
  - packages/convention-openapi/src/types.ts
  - packages/viewer/src/components/ui/switch.tsx
  - packages/viewer/src/components/ui/button.tsx
  - packages/viewer/src/components/ui/sheet.tsx
  - packages/viewer/tsconfig.json
  - apps/flow-viewer/tsconfig.json
  - packages/viewer/src/flowGraphToReactFlow.ts
  - packages/viewer/src/types.ts
  - packages/viewer/src/hooks/use-websocket.ts
  - packages/viewer/src/index.css
  - apps/flow-viewer/src/App.tsx
  - apps/flow-viewer/src/lib/params.ts
  - apps/flow-viewer/src/components/ui/tooltip.tsx
  - packages/viewer/tsup.config.ts
  - packages/viewer/src/components/ui/separator.tsx
  - apps/flow-viewer/server/index.ts
  - packages/core/src/substitute.ts
  - apps/flow-viewer/src/components/FlowMainContent.tsx
  - workspace/custom-handler/payments-handler.mjs
  - apps/cli/src/cli.ts
  - packages/viewer/components.json
  - apps/flow-viewer/src/components/ui/sidebar.tsx
  - packages/workspace/src/index.ts
  - apps/flow-viewer/src/hooks/use-flow-graph.ts
  - packages/viewer/src/components/FlowHeader.tsx
  - packages/viewer/src/hooks/use-workspace.ts
  - packages/viewer/package.json
  - packages/viewer/src/components/ui/collapsible.tsx
  - packages/core/src/handler-factory.ts
  - packages/handlers/src/command.ts
  - apps/cli/package.json
  - apps/flow-viewer/src/types.ts
  - packages/viewer/src/hooks/use-flow-graph.ts
  - packages/convention-openapi/src/openApiToFlows.ts
  - workspace/custom-handler/txn-token-handler.mjs
  - workspace/src/logisticsCenter.ts
  - workspace/flows/tt/test.yaml
  - packages/viewer/src/components/FlowCanvas.tsx
  - apps/flow-viewer/src/components/ui/dialog.tsx
  - apps/flow-viewer/src/components/ui/input.tsx
  - packages/viewer/src/lib/params.ts
  - packages/core/src/safeExpression.ts
  - packages/core/src/utils.ts
  - eslint.config.mjs
  - packages/workspace/src/format.ts
  - packages/viewer/server/lib/index.ts
  - apps/flow-viewer/vite.config.ts
  - README.md
  - apps/flow-viewer/src/components/ui/skeleton.tsx
  - packages/viewer/src/lib/nested.ts
  - apps/flow-viewer/src/components/ui/card.tsx
  - apps/mcp-server/src/tools.ts
  - packages/viewer/src/components/ui/tooltip.tsx
  - packages/viewer/src/components/FlowSidebar.tsx
  - packages/viewer/src/components/ui/select.tsx
  - packages/viewer/src/hooks/use-mobile.ts
  - packages/viewer/src/components/ui/card.tsx
  - apps/mcp-server/src/index.ts
  - packages/viewer/src/components/ParamsSheet.tsx
  - apps/flow-viewer/src/lib/nested.ts
  - packages/viewer/src/main.tsx
  - apps/flow-viewer/src/components/ResultDialog.tsx
  - packages/viewer/src/components/ui/tabs.tsx
  - apps/flow-viewer/server/workspace-api.ts
  - ARCHITECTURAL_REFORM.md
  - packages/workspace/src/snapshot.ts
  - apps/flow-viewer/src/components/ui/separator.tsx
  - packages/viewer/src/components/ParamsForm.tsx
  - apps/flow-viewer/src/components/ui/sheet.tsx
  - packages/handlers/src/sleep.ts
  - workspace/src/promotionRules.ts
  - packages/viewer/src/components/FlowMainContent.tsx
  - apps/flow-viewer/src/components/ParamsForm.tsx
  - workspace/custom-handler/scm-handler.mjs
  - packages/viewer/src/App.tsx
  - apps/flow-viewer/src/layout.ts
  - packages/viewer/vite.config.ts
  - apps/flow-viewer/package.json
  - workspace/custom-handler/promotion-rules-handler.mjs
  - apps/cli/src/dev.ts
  - packages/viewer/server/workspace-api.ts
  - workspace/custom-handler/txn-last-token-handler.mjs
  - packages/viewer/server/index.ts
  - apps/mcp-server/src/fixtures/.runflow/runs/latest.json
  - workspace/config/.runflow/runs/latest.json
  - apps/flow-viewer/src/hooks/use-theme.ts
  - apps/flow-viewer/src/hooks/use-mobile.ts
  - packages/viewer/index.html
  - packages/core/src/index.ts
  - packages/viewer/src/hooks/use-theme.ts
  - packages/workspace/src/discover.ts
  - packages/viewer/src/components/ui/skeleton.tsx
  - apps/flow-viewer/index.html
  - apps/flow-viewer/src/components/FlowHeader.tsx
  - packages/handlers/src/http.ts
  - apps/flow-viewer/vitest.config.ts
  - apps/flow-viewer/src/lib/utils.ts
  - packages/viewer/src/lib/utils.ts
  - packages/viewer/src/components/ui/sidebar.tsx
  - apps/flow-viewer/src/main.tsx
  - packages/workspace/src/config.ts
  - apps/flow-viewer/src/hooks/use-workspace.ts
  - packages/handlers/src/index.ts
  - apps/flow-viewer/src/components/ui/select.tsx
  - pnpm-workspace.yaml
tests:
  - apps/cli/src/cli.validate.test.ts
  - packages/handlers/src/http.test.ts
  - packages/core/src/substitute.test.ts
  - packages/handlers/src/sleep.test.ts
  - packages/convention-openapi/src/collectOperations.test.ts
  - packages/viewer/src/flowGraphToReactFlow.test.ts
  - packages/workspace/src/format.test.ts
  - apps/mcp-server/src/tools.test.ts
  - packages/convention-openapi/src/writeFlows.test.ts
  - packages/viewer/src/layout.test.ts
  - packages/viewer/src/flowDefinitionToGraph.test.ts
  - apps/cli/src/cli.inspect.test.ts
  - packages/workspace/src/discover.test.ts
  - apps/cli/src/cli.run.test.ts
  - packages/viewer/server/workspace-api.test.ts
  - apps/flow-viewer/src/flowGraphToReactFlow.test.ts
  - apps/flow-viewer/server/workspace-api.test.ts
  - packages/core/src/utils.test.ts
  - packages/core/src/safeExpression.test.ts
  - apps/flow-viewer/src/flowDefinitionToGraph.test.ts
  - packages/core/src/engine.test.ts
  - packages/core/src/hooks.test.ts
  - packages/core/src/hooks_v2.test.ts
  - apps/flow-viewer/src/layout.test.ts
-->

---
### Requirement: The system SHALL validate for duplicate Flow IDs after normalization

After normalizing all Flow IDs, the system SHALL check for duplicates and SHALL report errors when duplicate normalized IDs are found. The error message SHALL include:
1. The normalized Flow ID that is duplicated
2. The original Flow IDs that resulted in the duplicate
3. The source locations of the duplicate IDs

#### Scenario: Duplicate normalized IDs are detected

- **WHEN** two different Flow IDs normalize to the same value (e.g., `tt%2Fpost-users.yaml` and `tt/post-users.yaml` both normalize to `tt_post-users.yaml`)
- **THEN** the system SHALL detect the duplicate during catalog discovery
- **AND** SHALL mark the catalog entry with an error message indicating the duplicate
- **AND** the error message SHALL include both original IDs and the normalized ID

#### Scenario: Error message provides context for duplicate IDs

- **WHEN** a duplicate normalized Flow ID is detected
- **THEN** the error message SHALL be in the format: `Duplicate flowId: ${normalizedId} (original: ${originalId}, already defined in ${source})`
- **AND** SHALL include sufficient information to identify and resolve the conflict

#### Scenario: First occurrence of a normalized ID is accepted

- **WHEN** multiple Flow IDs normalize to the same value
- **THEN** the first occurrence SHALL be accepted and stored in the catalog
- **AND** subsequent occurrences SHALL be marked with duplicate error messages

<!-- @trace
source: normalize-flow-ids-and-validate-duplicates
updated: 2026-03-09
code:
  - packages/viewer/src/flowDefinitionToGraph.ts
  - apps/flow-viewer/src/flowGraphToReactFlow.ts
  - packages/convention-openapi/src/collectOperations.ts
  - apps/flow-viewer/src/flowDefinitionToGraph.ts
  - packages/viewer/src/layout.ts
  - apps/cli/.runflow/runs/latest.json
  - packages/core/src/engine.ts
  - apps/flow-viewer/src/components/FlowCanvas.tsx
  - apps/flow-viewer/src/index.css
  - apps/flow-viewer/src/components/FlowSidebar.tsx
  - packages/viewer/src/components/ResultDialog.tsx
  - apps/flow-viewer/components.json
  - workspace/config/runflow.config.json
  - apps/flow-viewer/src/components/ParamsSheet.tsx
  - packages/viewer/src/components/ui/dialog.tsx
  - apps/flow-viewer/src/components/ui/switch.tsx
  - apps/cli/src/cli.test-utils.ts
  - apps/flow-viewer/src/components/ui/button.tsx
  - packages/convention-openapi/src/writeFlows.ts
  - apps/flow-viewer/src/components/ui/collapsible.tsx
  - packages/viewer/vitest.config.ts
  - packages/viewer/src/components/ui/input.tsx
  - workspace/custom-handler/logistics-center-handler.mjs
  - packages/core/src/types.ts
  - packages/convention-openapi/src/types.ts
  - packages/viewer/src/components/ui/switch.tsx
  - packages/viewer/src/components/ui/button.tsx
  - packages/viewer/src/components/ui/sheet.tsx
  - packages/viewer/tsconfig.json
  - apps/flow-viewer/tsconfig.json
  - packages/viewer/src/flowGraphToReactFlow.ts
  - packages/viewer/src/types.ts
  - packages/viewer/src/hooks/use-websocket.ts
  - packages/viewer/src/index.css
  - apps/flow-viewer/src/App.tsx
  - apps/flow-viewer/src/lib/params.ts
  - apps/flow-viewer/src/components/ui/tooltip.tsx
  - packages/viewer/tsup.config.ts
  - packages/viewer/src/components/ui/separator.tsx
  - apps/flow-viewer/server/index.ts
  - packages/core/src/substitute.ts
  - apps/flow-viewer/src/components/FlowMainContent.tsx
  - workspace/custom-handler/payments-handler.mjs
  - apps/cli/src/cli.ts
  - packages/viewer/components.json
  - apps/flow-viewer/src/components/ui/sidebar.tsx
  - packages/workspace/src/index.ts
  - apps/flow-viewer/src/hooks/use-flow-graph.ts
  - packages/viewer/src/components/FlowHeader.tsx
  - packages/viewer/src/hooks/use-workspace.ts
  - packages/viewer/package.json
  - packages/viewer/src/components/ui/collapsible.tsx
  - packages/core/src/handler-factory.ts
  - packages/handlers/src/command.ts
  - apps/cli/package.json
  - apps/flow-viewer/src/types.ts
  - packages/viewer/src/hooks/use-flow-graph.ts
  - packages/convention-openapi/src/openApiToFlows.ts
  - workspace/custom-handler/txn-token-handler.mjs
  - workspace/src/logisticsCenter.ts
  - workspace/flows/tt/test.yaml
  - packages/viewer/src/components/FlowCanvas.tsx
  - apps/flow-viewer/src/components/ui/dialog.tsx
  - apps/flow-viewer/src/components/ui/input.tsx
  - packages/viewer/src/lib/params.ts
  - packages/core/src/safeExpression.ts
  - packages/core/src/utils.ts
  - eslint.config.mjs
  - packages/workspace/src/format.ts
  - packages/viewer/server/lib/index.ts
  - apps/flow-viewer/vite.config.ts
  - README.md
  - apps/flow-viewer/src/components/ui/skeleton.tsx
  - packages/viewer/src/lib/nested.ts
  - apps/flow-viewer/src/components/ui/card.tsx
  - apps/mcp-server/src/tools.ts
  - packages/viewer/src/components/ui/tooltip.tsx
  - packages/viewer/src/components/FlowSidebar.tsx
  - packages/viewer/src/components/ui/select.tsx
  - packages/viewer/src/hooks/use-mobile.ts
  - packages/viewer/src/components/ui/card.tsx
  - apps/mcp-server/src/index.ts
  - packages/viewer/src/components/ParamsSheet.tsx
  - apps/flow-viewer/src/lib/nested.ts
  - packages/viewer/src/main.tsx
  - apps/flow-viewer/src/components/ResultDialog.tsx
  - packages/viewer/src/components/ui/tabs.tsx
  - apps/flow-viewer/server/workspace-api.ts
  - ARCHITECTURAL_REFORM.md
  - packages/workspace/src/snapshot.ts
  - apps/flow-viewer/src/components/ui/separator.tsx
  - packages/viewer/src/components/ParamsForm.tsx
  - apps/flow-viewer/src/components/ui/sheet.tsx
  - packages/handlers/src/sleep.ts
  - workspace/src/promotionRules.ts
  - packages/viewer/src/components/FlowMainContent.tsx
  - apps/flow-viewer/src/components/ParamsForm.tsx
  - workspace/custom-handler/scm-handler.mjs
  - packages/viewer/src/App.tsx
  - apps/flow-viewer/src/layout.ts
  - packages/viewer/vite.config.ts
  - apps/flow-viewer/package.json
  - workspace/custom-handler/promotion-rules-handler.mjs
  - apps/cli/src/dev.ts
  - packages/viewer/server/workspace-api.ts
  - workspace/custom-handler/txn-last-token-handler.mjs
  - packages/viewer/server/index.ts
  - apps/mcp-server/src/fixtures/.runflow/runs/latest.json
  - workspace/config/.runflow/runs/latest.json
  - apps/flow-viewer/src/hooks/use-theme.ts
  - apps/flow-viewer/src/hooks/use-mobile.ts
  - packages/viewer/index.html
  - packages/core/src/index.ts
  - packages/viewer/src/hooks/use-theme.ts
  - packages/workspace/src/discover.ts
  - packages/viewer/src/components/ui/skeleton.tsx
  - apps/flow-viewer/index.html
  - apps/flow-viewer/src/components/FlowHeader.tsx
  - packages/handlers/src/http.ts
  - apps/flow-viewer/vitest.config.ts
  - apps/flow-viewer/src/lib/utils.ts
  - packages/viewer/src/lib/utils.ts
  - packages/viewer/src/components/ui/sidebar.tsx
  - apps/flow-viewer/src/main.tsx
  - packages/workspace/src/config.ts
  - apps/flow-viewer/src/hooks/use-workspace.ts
  - packages/handlers/src/index.ts
  - apps/flow-viewer/src/components/ui/select.tsx
  - pnpm-workspace.yaml
tests:
  - apps/cli/src/cli.validate.test.ts
  - packages/handlers/src/http.test.ts
  - packages/core/src/substitute.test.ts
  - packages/handlers/src/sleep.test.ts
  - packages/convention-openapi/src/collectOperations.test.ts
  - packages/viewer/src/flowGraphToReactFlow.test.ts
  - packages/workspace/src/format.test.ts
  - apps/mcp-server/src/tools.test.ts
  - packages/convention-openapi/src/writeFlows.test.ts
  - packages/viewer/src/layout.test.ts
  - packages/viewer/src/flowDefinitionToGraph.test.ts
  - apps/cli/src/cli.inspect.test.ts
  - packages/workspace/src/discover.test.ts
  - apps/cli/src/cli.run.test.ts
  - packages/viewer/server/workspace-api.test.ts
  - apps/flow-viewer/src/flowGraphToReactFlow.test.ts
  - apps/flow-viewer/server/workspace-api.test.ts
  - packages/core/src/utils.test.ts
  - packages/core/src/safeExpression.test.ts
  - apps/flow-viewer/src/flowDefinitionToGraph.test.ts
  - packages/core/src/engine.test.ts
  - packages/core/src/hooks.test.ts
  - packages/core/src/hooks_v2.test.ts
  - apps/flow-viewer/src/layout.test.ts
-->