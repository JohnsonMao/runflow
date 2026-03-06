## Why

目前的 Flow 引擎在步驟失敗時會繼續執行不相關的 DAG 分支，缺乏靈活的中斷控制。同時，API 呼叫（http/openapi）缺乏詳細且安全的日誌記錄，且當回應過大時，AI 常因 Token 限制無法處理，或被迫重複執行非等冪（non-idempotent）的 API 以獲取資訊，這會導致副作用並增加成本。

## What Changes

- **引擎中斷機制**: 在 `RunOptions` 與 `FlowStep` 中新增 `continueOnError` 選項（預設為 `false`），當步驟失敗時立即中止後續不相關步驟的執行。
- **安全 API 日誌**: 實作 API 回應的自動日誌記錄，包含敏感標頭（如 Authorization）與 Body 欄位（如 password, token）的遮蔽機制。
- **智能摘要與截斷**: 針對大型 API 回應實作摘要與截斷邏輯，防止日誌過大導致 Token 超支或終端機混亂。
- **表達式引擎增強**: 升級 `safe-expression` 支援陣列方法（如 `.map()`, `.filter()`, `.slice()`），讓 AI 能精準過濾所需資訊。
- **執行快照與檢查**: 每次執行後自動將完整 outputs 儲存至 `.runflow/runs/latest.json`，並提供 `inspect` 機制供查詢詳細資料而無需重複執行。

## Capabilities

### New Capabilities

- `engine-early-termination`: 定義 `continueOnError` 控制邏輯，決定步驟失敗時引擎是否應中止後續 Wave。
- `api-logging-security`: 定義 API 回應日誌的格式、敏感資訊遮蔽規則，以及大型資料的摘要與截斷標準。
- `execution-snapshot-inspect`: 定義執行快照的儲存結構，以及透過表達式查詢快照資料的 `inspect` 機制。

### Modified Capabilities

- `template-substitution`: 擴展表達式語法，新增對陣列處理方法（map, filter, slice）的支援。

## Impact

- `packages/core`: 修改引擎執行迴圈、快照儲存邏輯與表達式解析器。
- `packages/handlers`: 更新 `http` handler 實作日誌摘要與遮蔽。
- `apps/cli`: 新增 `inspect` 子指令。
- `apps/mcp-server`: 新增用於查詢快照的工具。
