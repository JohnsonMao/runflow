import type { FlowGraph } from '../types'
import React from 'react'
import { ReactFlowProvider } from 'reactflow'
import { FlowCanvas } from './FlowCanvas'

interface FlowMainContentProps {
  graphLoading: boolean
  graph: FlowGraph | null
  stepStatuses?: Record<string, string>
  canvasRef?: React.MutableRefObject<{ fitView: () => void } | null>
}

export function FlowMainContent({ graphLoading, graph, stepStatuses, canvasRef }: FlowMainContentProps): React.ReactElement {
  if (graphLoading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        載入流程圖…
      </div>
    )
  }
  if (graph) {
    return (
      <ReactFlowProvider>
        <div className="h-full w-full">
          <FlowCanvas graph={graph} stepStatuses={stepStatuses} canvasRef={canvasRef} />
        </div>
      </ReactFlowProvider>
    )
  }
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center text-muted-foreground">
      <p className="text-sm font-medium">點選左側資料夾樹中的 flow 檔案（.yaml）或 OpenAPI 操作</p>
      <p className="text-xs">
        工作區由 runflow.config 的 flowsDir 與 openapi 決定，與 CLI / MCP 設定一致。
      </p>
    </div>
  )
}
