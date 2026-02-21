# Design: flow-review-params-execute

## Context

Runflow 已有 flow 探索（discover catalog、getDiscoverEntry）與 MCP 工具（discover_flow_list、discover_flow_detail、executor_flow）。DiscoverEntry 已含 flowId、name、description、params（ParamDeclaration[]）、steps。流程圖可由 CLI `flow view --output json` 或由 FlowDefinition 推得（flow-graph-format）。本 change 要讓「flow 檢視」介面在單一畫面中提供：流程圖、params 展示/編輯、手動執行。實作可能發生在 MCP 客戶端（如 Cursor）、未來 Runflow Web GUI、或其它消費 discover/executor 的介面。

## Goals / Non-Goals

**Goals:**

- 定義 flow 檢視介面規格（flow-review-ui）：選取 flow 時顯示流程圖、該 flow 的 params、以及手動執行入口。
- 資料與執行沿用既有能力：詳情來自 discover（或 workspace），圖來自 flow-graph-format / FlowDefinition，執行來自 executor_flow 或 core run()。
- 不新增執行或探索 API，僅規範介面行為與資料來源。

**Non-Goals:**

- 不規定 UI 框架或技術（React / Vue / MCP client 皆可）。
- 不改變 web-flow-visualization 的唯讀語意；flow-review-ui 可內嵌或複用圖元件，但「可執行」屬於 flow-review-ui 的責任。
- 不實作具體產品 UI 在本 repo（僅 spec + design，實作由消費者依 spec 做）。

## Decisions

1. **flow-review-ui 為獨立 capability**
   - 與 web-flow-visualization 分開：後者維持「唯讀圖檢視」；前者定義「檢視 flow + params + 執行」的完整介面。
   - 理由：職責單一、避免把「可執行」塞進既有唯讀 spec，且不同消費者（MCP client vs Web）可只實作 flow-review-ui 的 subset。

2. **Params 來源以 discover 詳情為準**
   - 介面顯示的 params 來自 DiscoverEntry.params（即 flow 或 effective params 宣告），型別與驗證語意依 flow-params-schema。
   - 理由：workspace/MCP 已產出 params；不需為 flow-review 新增專用 API。

3. **執行介面沿用現有**
   - 手動執行 = 以 flowId + 使用者填寫的 params 呼叫既有執行端（executor_flow 或等同 run(flow, { params })）。
   - 理由：不引入新執行協定，驗證與錯誤處理沿用 flow-params-schema 與 executor。

4. **流程圖輸入格式不擴充**
   - 使用 flow-graph-format（nodes/edges）或 FlowDefinition；不為 flow-review 定義新圖格式。
   - 理由：與 CLI / web-flow-visualization 一致，減少重複。

## Risks / Trade-offs

- **Risk**: 不同客戶端（MCP vs Web）實作不一致。  
  **Mitigation**: spec 只規定「顯示什麼、能做什麼」，不規定版面或元件；實作時可共用同一份 flow-review-ui spec 解讀。

- **Trade-off**: 不強制「執行前客戶端驗證 params」。  
  可接受：執行端（core / MCP）會驗證；客戶端可選擇性做即時驗證以改善 UX。

- **Risk**: discover 的 limit 可能導致部分 flow 未出現在列表。  
  **Mitigation**: 屬既有 discover 行為；flow-review-ui 只規範「當使用者已選到某 flow 時」的介面，不改變 catalog 大小。

## Migration Plan

- 無需資料遷移或部署步驟。本 change 僅新增 spec 與 design；實作由各消費者依時程加入。
- 若未來在 monorepo 內新增 GUI app，可依 flow-review-ui spec 與此 design 實作。

## Open Questions

- 無。若未來需「執行前預覽」或「部分執行」，可再擴充 flow-review-ui 或新 capability。
