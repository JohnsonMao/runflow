# Proposal: Loop 語意修正 — 每輪結束點、完整 closure、不強調 early exit

## Why

1. **與預期不一致**：目前 loop handler 曾用 `end`（及 done）過濾 closure，導致 body 未跑「完整一輪」；且離開 loop 時不應執行 done，done 也不應隨 loop 次數重複。
2. **end 語意**：應以**每輪結束的節點**（round end）表示「這一輪跑完」；不依 end 過濾 closure。未傳遞 `end` 時可推斷為 closure 的 sink（如 noop、nap2）。
3. **不需單獨判斷 early exit**：改為「每輪結束點 steps 都執行完成就進入下一輪或 done；只有當某步 nextSteps 指向 closure 外時才離開 loop 且不跑 done」— 不需額外「是否 early exit」的判斷邏輯。
4. **顯示順序**：希望 loop start、iteration i/N 能**插在 body 之間**；本 change 描述需求與可行作法，正式支援可列後續。

## What Changes

- **每輪結束點（end）**：代表「這一輪結束」的 step(s)，可選；未提供時推斷為 closure 的 **sink**。end 不用於過濾 closure，僅語意與可視化。
- **Closure 不過濾 end/done**：迭代範圍 = 從 entry 的完整 closure；每輪跑完整 closure，跑完即一輪結束。
- **一輪結束後**：依 when/items/count 決定回傳 **done**（執行一次）或**下一輪**。不需判斷「是否 early exit」。
- **控制離開本輪**：僅當 runSubFlow 回傳 **earlyExit**（某步 nextSteps 含 closure 外 id）時，loop 立即結束並回傳該 nextSteps，**不**跑 done。runSubFlow 的 earlyExit 即代表「有 step 指向 round 外」，無需額外邏輯。
- **插在 body 之間**：設計與 spec 描述選項（marker step、display 層虛擬插入等），實作可列後續。

## Capabilities

### Modified

- **loop-step**：closure = 完整 closure from entry（不排除 end）；early exit 時回傳 step 的 nextSteps、不回傳 done；end 可省略並可依 closure 的 sink 推斷。
- **@runflow/handlers (loop)**：移除依 end/done 過濾 closure 的邏輯；可選：當未提供 end 時可依 closure sink 供 log/顯示用。

## Impact

- **既有 flow**：若目前依賴「end 排除於 closure」的行為（例如 early exit 到 end 節點），需改為：early exit 的 nextSteps 指向 closure 外步驟；若指向 closure 內步驟則為一般分支，該輪會繼續跑完。
- **tt/test.yaml**：可移除 `end: [nap2]` 或保留僅作可視化；closure 將含 noop、nap2，行為符合「一輪跑完 loopBody → earlyExitCond → noop/nap2，再依 when/early exit 決定下一輪或 done」。
