## ADDED Requirements

### Requirement: Node Visual Highlighting SHALL reflect current execution state
The system SHALL enhance the visual appearance of nodes to indicate their current status (running, success, failure) with distinct effects.

#### Scenario: Running node animation
- **WHEN** a node has status `running`
- **THEN** the viewer SHALL apply a blue glow effect (e.g., outer shadow) and a pulse animation to the node

#### Scenario: Successful node highlighting
- **WHEN** a node has status `success`
- **THEN** the viewer SHALL apply a strong green background and border, and optional "check" icon

### Requirement: Edge Highlighting SHALL reflect active execution path
The system SHALL highlight the edges connecting completed steps to current or subsequent steps to visualize the flow path.

#### Scenario: Animate edges on the execution path
- **WHEN** a source node is `success` or `running` AND its target node is `running`
- **THEN** the edge connecting them SHALL be rendered with a bright blue color, increased thickness, and a flow animation (moving dash)
