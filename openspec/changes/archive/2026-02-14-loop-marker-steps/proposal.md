# Proposal: Loop marker steps（loop start / iteration i/N 插在 body 之間）

## Why

在 loop 執行時，希望「loop start」與「iteration i/N」能**插在 body steps 之間**顯示，讓 GUI / Server / CLI 依 `RunResult.steps` 順序即可還原執行時間軸，不需解析 loop step 的合併 log。  
本需求在 change **loop-closure-full-end-infer** 的 design 中已描述並建議採用 **選項 A（Marker / 合成 step）**；此 change 作為後續實作追蹤，避免遺忘。

## What（預定方向）

- **StepContext** 擴充：提供 `pushMarkerStep?.(stepId: string, log: string)`（或等價 API），讓 handler 在適當時機將「僅含 stepId + log」的標記 step push 進主 `steps`。
- **Executor**：在 runSubFlow / 主迴圈中支援上述 push，使 marker 出現在正確順序（例如 loop._start → body 輪1 → loop._iteration_1 → body 輪2 → … → loop step）。
- **Loop handler**：在 loop 開始時 push marker「loop start」、每輪 runBody 後 push「iteration i/N」、結束時 push 或回傳「loop complete」；body 步驟維持即時 push，故順序自然為：start → body → iter1 → body → …。
- **RunResult.steps**：單一契約，GUI / Server 依序渲染即可，不需虛擬插入或解析 log。

## 參考

- `openspec/changes/loop-closure-full-end-infer/design.md` — 決策 4「插在 body 之間」、建議選項 A 及與 B/C 的比較。

## 狀態

Backlog；尚未開始實作。要開始時再補 design、spec delta、tasks。
