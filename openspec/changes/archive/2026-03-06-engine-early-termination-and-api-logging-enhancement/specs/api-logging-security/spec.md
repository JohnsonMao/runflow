# api-logging-security Specification

## ADDED Requirements

### Requirement: http handler SHALL log response summary
When executing an `http` step, the handler SHALL include a summary in the `log` field of the StepResult. This summary SHALL contain the HTTP method, URL, and status code (e.g., `GET http://example.com -> 200`).

#### Scenario: Successful request log
- **WHEN** a GET request to http://example.com returns 200
- **THEN** the step log SHALL include `GET http://example.com -> 200`

### Requirement: Sensitive data SHALL be redacted in logs
The system SHALL redact sensitive information in HTTP request/response logs. Sensitive headers (e.g., `Authorization`, `Cookie`, `Proxy-Authorization`) SHALL NOT be included in logs. Common sensitive keys in JSON bodies (e.g., `password`, `token`, `secret`, `access_token`, `refresh_token`, `api_key`) SHALL be replaced with `[REDACTED]`.

#### Scenario: Sensitive headers omitted
- **WHEN** an HTTP request is made with an `Authorization` header
- **THEN** the header SHALL NOT appear in the log output

#### Scenario: Sensitive body fields redacted
- **WHEN** an HTTP response body is `{ "id": 1, "password": "abc" }`
- **THEN** the log SHALL show `{ "id": 1, "password": "[REDACTED]" }`

### Requirement: Large response bodies SHALL be truncated in logs
When the response body exceeds a predefined character limit (e.g., 2048 characters), the log output SHALL be truncated. A notice SHALL be appended indicating that the full response is available in the execution snapshot.

#### Scenario: Truncation notice
- **WHEN** an HTTP response body is larger than 2048 characters
- **THEN** the log SHALL show a truncated portion of the body
- **AND** the log SHALL append a message: `[Body truncated (too large). Full result saved to snapshot. Use 'inspect' command to query details.]`
