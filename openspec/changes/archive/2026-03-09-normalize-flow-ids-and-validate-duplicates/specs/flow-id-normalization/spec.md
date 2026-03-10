## ADDED Requirements

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
