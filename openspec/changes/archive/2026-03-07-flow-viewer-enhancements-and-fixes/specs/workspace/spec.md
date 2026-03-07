## MODIFIED Requirements

### Requirement: Workspace SHALL provide discover catalog and entry lookup

The workspace SHALL export **findFlowFiles**, **buildDiscoverCatalog(config, configDir, cwd)**, and **getDiscoverEntry(catalog, flowId)**. buildDiscoverCatalog SHALL return **DiscoverEntry[]**. OpenAPI-derived entries SHALL be produced only from **config.handlers**: for each key whose value is an OpenAPI entry (object with **specPaths**), the implementation SHALL merge the specs at specPaths, call openApiToFlows on the merged result, and SHALL add entries with flowId `key-operationKey`. buildDiscoverCatalog SHALL NOT read or use a top-level config.openapi. **DEFAULT_DISCOVER_LIMIT** and **MAX_DISCOVER_LIMIT** SHALL both be **10**. Caller applies keyword, limit, offset. File flows SHALL be discovered only from the **flowsDir** (or cwd when flowsDir is absent); no other directory SHALL be used for file flow scope.

#### Scenario: getDiscoverEntry returns entry by flowId
- **WHEN** the caller has a catalog from buildDiscoverCatalog and invokes getDiscoverEntry(catalog, flowId)
- **THEN** if flowId exists in the catalog the return value SHALL be that DiscoverEntry
- **AND** if not found the return value SHALL be undefined (or equivalent)

#### Scenario: buildDiscoverCatalog returns file and OpenAPI flows from handlers only
- **WHEN** config has flowsDir and at least one handlers entry that is an OpenAPI entry (object with specPaths), and the caller invokes buildDiscoverCatalog(config, configDir, cwd)
- **THEN** the returned array SHALL include entries for file flows and for OpenAPI flows
- **AND** each entry SHALL have flowId, name, description (optional), params (optional, ParamDeclaration[]), and **tags** (optional, string[])
- **AND** the `flowId` SHALL be the custom `id` defined in the flow if present, otherwise the relative path or handler-operation string
- **AND** the implementation SHALL enforce global `flowId` uniqueness and record errors for duplicates

## ADDED Requirements

### Requirement: Workspace SHALL provide tree structure for navigation

The workspace SHALL provide a method to build a navigation tree (TreeNode[]) from the catalog, supporting both Folder View and Tag View.

#### Scenario: Building Tag-based virtual tree
- **WHEN** the workspace builds a Tag-based tree
- **THEN** it SHALL create a virtual folder for each unique tag found in the catalog
- **AND** it SHALL place each flow into all folders corresponding to its tags
- **AND** it SHALL place flows without tags into an "Untagged" folder
