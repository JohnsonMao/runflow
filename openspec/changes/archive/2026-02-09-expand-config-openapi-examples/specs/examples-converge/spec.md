# Spec: examples-converge

## ADDED Requirements

### Requirement: Examples directory SHALL contain only a representative set

The `examples/` directory SHALL be reduced to a small, representative set of examples. The set SHALL cover: a minimal flow, parameters (and params-schema), DAG (linear and parallel), HTTP step, JS step (file), and custom handler (one subdirectory). All other example files that duplicate or overlap these capabilities SHALL be removed or merged.

#### Scenario: Representative examples are present

- **WHEN** a user lists the contents of `examples/`
- **THEN** they SHALL find at most one example per representative category (e.g. one hello, one params, one params-schema, one or two dag, one http, one js-file, one custom-handler directory) and SHALL NOT find redundant examples that demonstrate the same capability

#### Scenario: Removed examples are documented

- **WHEN** an example file or directory is removed as part of convergence
- **THEN** the change SHALL document the removal (e.g. in README or commit/PR) and SHALL indicate which remaining example (if any) replaces it

### Requirement: Examples structure and naming

The structure of `examples/` SHALL remain flat for YAML files plus at most one subdirectory for the custom-handler example. Naming SHALL be consistent and descriptive (e.g. `hello-flow.yaml`, `params-flow.yaml`, `dag-linear-flow.yaml`, `dag-parallel-flow.yaml`, `http-flow.yaml`, `js-file-flow.yaml`, `custom-handler/`).

#### Scenario: Flat YAML and single subdirectory

- **WHEN** a user inspects `examples/`
- **THEN** they SHALL see only top-level YAML files and at most one subdirectory (`custom-handler/`) and SHALL NOT see multiple nested example directories

#### Scenario: Names are self-explanatory

- **WHEN** a user reads filenames in `examples/`
- **THEN** each name SHALL reflect the primary capability (e.g. params, dag, http, js-file, custom-handler) so that documentation can reference them by name

### Requirement: Documentation references converged examples

README or project documentation that references the examples directory SHALL list only the converged set and SHALL NOT reference removed files. Any link or path to an example SHALL point to a file or directory that exists after convergence.

#### Scenario: README lists only existing examples

- **WHEN** a user follows documentation that points to `examples/`
- **THEN** every linked or listed example path SHALL exist and SHALL be one of the representative examples

#### Scenario: No broken example links

- **WHEN** convergence removes an example that was previously linked
- **THEN** the documentation SHALL be updated in the same change so that no link targets a removed file
