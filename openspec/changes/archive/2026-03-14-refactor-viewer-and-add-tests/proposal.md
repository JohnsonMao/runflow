## Why

`@packages/viewer` 目前的架構耦合度較高，API 路由邏輯過於龐大且缺乏單元測試。為了提升代碼的可維護性、可讀性及穩定性，需要進行系統性的重構與測試補充。

## What Changes

- **模組化後端 API**: 將 `workspace-api.ts` 中的大型 Middleware 拆分為獨立的路由 Handler。
- **解耦執行邏輯**: 將 `execution.ts` 中的 `reloadAndExecuteFlow` 職責細分，分離執行、圖表轉換與廣播邏輯。
- **強化前端通訊**: 優化 `App.tsx` 的消息處理機制，增強 `useWebSocket` 的類型安全性與重連穩定性。
- **集中化類型管理**: 整理並集中跨端共享的類型定義。
- **補齊測試覆蓋率**: 為 `execution.ts`、`workspace-api.ts`、`useWebSocket` 及 `App.tsx` 增加單元測試。

## Capabilities

### New Capabilities

- `viewer-workspace-api`: Define the behavior of the workspace API in the viewer server, ensuring modularity and testability.

### Modified Capabilities

(none)

## Impact

- Affected code:
  - `packages/viewer/server/workspace-api.ts`
  - `packages/viewer/server/execution.ts`
  - `packages/viewer/server/app.ts`
  - `packages/viewer/src/App.tsx`
  - `packages/viewer/src/hooks/use-websocket.ts`
  - `packages/viewer/src/types.ts`
  - `packages/viewer/server/state.ts`
  - `apps/cli/src/dev.ts`
