# js-step-file Specification

## Purpose

定義 js 步驟的檔案載入：除現有 inline `run` 字串外，支援選用 `file` 欄位指定一 `.js` 檔案路徑；有 `file` 時從該檔案讀取程式碼並執行，路徑相對 flow 檔案所在目錄。僅支援 .js，不支援 .ts。執行語意（context 注入、return 作為 outputs）與現有 js 步驟一致。

## Requirements

### Requirement: JS step MAY specify file instead of run

A flow step with `type: 'js'` MAY include an optional `file` field (string) pointing to a JavaScript file path. When `file` is present and valid, the engine SHALL load the file content and execute it as the step's code, with the same execution semantics as inline `run` (same context injection, same treatment of return value as outputs). When `file` is absent, the step SHALL use the `run` field (inline code) as today.

#### Scenario: JS step with file

- **WHEN** a flow contains a step `{ id: 's1', type: 'js', file: './scripts/step.js' }` and the file exists relative to the flow file directory
- **THEN** the executor reads the content of that file and executes it in the same way as inline js (vm, params, return value as outputs)
- **AND** the step produces a StepResult as for any js step

#### Scenario: JS step with run (unchanged)

- **WHEN** a flow contains a step `{ id: 's1', type: 'js', run: 'return 1 + 1' }` with no `file` field
- **THEN** behaviour is unchanged: the executor runs the inline code
- **AND** no file is loaded

### Requirement: file path SHALL be resolved relative to flow file directory

The path given in `file` SHALL be resolved relative to the directory of the flow file that contains the step. The loader or executor SHALL receive or compute the flow file path (e.g. from the loader that loaded the flow) and resolve `file` against that directory. Absolute paths MAY be disallowed or allowed; if allowed, resolution is implementation-defined.

#### Scenario: Relative path

- **WHEN** the flow file is at `/project/flows/main.yaml` and a step has `file: ./scripts/step.js`
- **THEN** the resolved path is `/project/flows/scripts/step.js` (or equivalent)
- **AND** that file is read for execution

### Requirement: Only .js files SHALL be supported

The implementation SHALL only load and execute files that are JavaScript (e.g. by extension `.js` or by content). TypeScript (`.ts`) files SHALL NOT be executed; if `file` points to a `.ts` file, the implementation MAY reject at parse time or at run time with a clear error.

#### Scenario: .ts file rejected

- **WHEN** a step has `file: ./script.ts`
- **THEN** the implementation SHALL either reject the flow (e.g. parser returns null) or fail the step with an error indicating .ts is not supported
- **AND** no TypeScript execution is performed

### Requirement: file and run mutual exclusivity

When `type` is `js`, the step SHALL have either `run` or `file`, not both required for validity. The exact rule (one required, the other optional; or exactly one of the two) SHALL be defined so that: (a) presence of `file` means load file and execute; (b) absence of `file` means use `run`. If both are present, implementation MAY prefer `file` over `run` or reject as invalid; the spec SHALL state the chosen behaviour.

#### Scenario: File takes precedence when both present (or reject)

- **WHEN** a step has both `run: 'return 1'` and `file: './other.js'`
- **THEN** either the file is executed (file takes precedence) or the flow/step is invalid (implementation MUST document which)
- **AND** when only `file` is present, file is used; when only `run` is present, run is used

### Requirement: Missing or unreadable file SHALL fail the step

If the resolved path does not exist, is not a file, or cannot be read, the step SHALL fail: StepResult SHALL have `success: false` and `error` set to a string describing the failure (e.g. file not found). The executor SHALL NOT execute any code from that step.

#### Scenario: File not found

- **WHEN** a step has `file: ./nonexistent.js` and the file does not exist at the resolved path
- **THEN** the step fails with success false and an error message indicating the file could not be loaded
- **AND** no code is executed
