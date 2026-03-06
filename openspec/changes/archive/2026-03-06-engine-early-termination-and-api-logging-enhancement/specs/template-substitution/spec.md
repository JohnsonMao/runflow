# template-substitution Specification (Delta)

## MODIFIED Requirements

### Requirement: Command step run SHALL support template substitution

The value of the `run` field of a step with `type: command` SHALL be processed for template substitution before being passed to the shell. Substitution SHALL use the current step context (initial params plus outputs of all previous steps). The syntax SHALL include root keys, dot notation for nested properties, bracket notation for array indices, and array processing methods (map, filter, slice).

#### Scenario: Root key substitution
- **WHEN** context is `{ who: 'world' }` and the command step has `run: "echo Hello {{ who }}"`
- **THEN** the string passed to the shell is `echo Hello world`
- **AND** the step runs with that command

#### Scenario: Dot notation
- **WHEN** context is `{ config: { debug: true, level: 2 } }` and run is `run: "echo {{ config.level }}"`
- **THEN** the substituted string is `echo 2`
- **AND** nested property is resolved correctly

#### Scenario: Bracket notation for array index
- **WHEN** context is `{ tags: ['a', 'b', 'c'] }` and run is `run: "echo {{ tags[0] }}"`
- **THEN** the substituted string is `echo a`
- **AND** array index 0 is resolved

#### Scenario: Array map method
- **WHEN** context is `{ users: [{id: 1, name: 'A'}, {id: 2, name: 'B'}] }` and run is `run: "echo {{ users.map(id) }}"`
- **THEN** the substituted string is `echo [1,2]`
- **AND** the property `id` is extracted from each array element

#### Scenario: Array filter method
- **WHEN** context is `{ items: [1, 2, 3, 4] }` and run is `run: "echo {{ items.filter(val > 2) }}"`
- **THEN** the substituted string is `echo [3,4]` (assuming basic comparison support)
- **AND** elements satisfying the condition are kept

#### Scenario: Array slice method
- **WHEN** context is `{ list: [1, 2, 3, 4, 5] }` and run is `run: "echo {{ list.slice(0, 2) }}"`
- **THEN** the substituted string is `echo [1,2]`
- **AND** a subset of the array is returned
