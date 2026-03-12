import type { FlowDetail } from '../types'
import { useEffect, useRef } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ParamsForm } from './ParamsForm'

export interface LogEntry {
  stepId: string
  status: string
  outputs?: unknown
  timestamp: number
}

function getStatusColor(status: string): string {
  if (status === 'success')
    return 'text-green-600'
  if (status === 'failure')
    return 'text-red-600'
  return 'text-blue-600'
}

function getStatusLabel(status: string): string {
  if (status === 'running')
    return '執行中...'
  if (status === 'success')
    return '成功'
  if (status === 'failure')
    return '失敗'
  return status
}

// List of dynamic fields that change between executions
const DYNAMIC_FIELD_PATTERNS = [
  /^date$/i,
  /^timestamp$/i,
  /^time$/i,
  /^x-request-id$/i,
  /^x-trace-id$/i,
  /^x-correlation-id$/i,
  /^etag$/i,
  /^last-modified$/i,
  /^expires$/i,
  /^age$/i,
]

function isDynamicField(key: string): boolean {
  return DYNAMIC_FIELD_PATTERNS.some(pattern => pattern.test(key))
}

// Recursively filter or mark dynamic fields in the output
function sanitizeOutputs(outputs: unknown, depth = 0): unknown {
  if (outputs === null || outputs === undefined)
    return outputs

  if (Array.isArray(outputs))
    return outputs.map(item => sanitizeOutputs(item, depth + 1))

  if (typeof outputs === 'object') {
    const obj = outputs as Record<string, unknown>
    const sanitized: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(obj)) {
      if (isDynamicField(key)) {
        // Mark dynamic fields with a placeholder
        sanitized[`${key} [動態]`] = typeof value === 'string' ? `[每次執行會不同] ${value}` : value
      }
      else {
        sanitized[key] = sanitizeOutputs(value, depth + 1)
      }
    }

    return sanitized
  }

  return outputs
}

// Check if outputs contain any dynamic fields
function hasDynamicFields(outputs: unknown): boolean {
  if (outputs === null || outputs === undefined)
    return false

  if (Array.isArray(outputs))
    return outputs.some(item => hasDynamicFields(item))

  if (typeof outputs === 'object') {
    const obj = outputs as Record<string, unknown>
    return Object.keys(obj).some(key => isDynamicField(key)) || Object.values(obj).some(value => hasDynamicFields(value))
  }

  return false
}

interface ExecutionPanelProps {
  flowDetail: FlowDetail | null
  paramValues: Record<string, unknown>
  onParamChange: (path: string, value: unknown) => void
  logs: LogEntry[]
  activeTab: 'params' | 'logs'
  onTabChange: (tab: 'params' | 'logs') => void
  paramErrors?: Record<string, string>
}

export function ExecutionPanel({
  flowDetail,
  paramValues,
  onParamChange,
  logs,
  activeTab,
  onTabChange,
  paramErrors = {},
}: ExecutionPanelProps): React.ReactElement {
  const params = flowDetail?.params ?? []
  const logsEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new logs are added
  useEffect(() => {
    if (activeTab === 'logs' && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, activeTab])

  return (
    <div className="flex h-full flex-col border-l border-border bg-background">
      <Tabs value={activeTab} onValueChange={v => onTabChange(v as 'params' | 'logs')} className="flex h-full flex-col">
        <div className="border-b border-border px-4 pt-3">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="params">Params</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="params" className="m-0 min-h-0 flex-1 overflow-auto p-4">
          {params.length > 0
            ? <ParamsForm params={params} paramValues={paramValues} onParamChange={onParamChange} paramErrors={paramErrors} />
            : flowDetail && <p className="text-sm text-muted-foreground">無需填寫參數</p>}
        </TabsContent>
        <TabsContent value="logs" className="m-0 min-h-0 flex-1 overflow-auto p-4">
          <div className="space-y-2">
            {logs.length === 0
              ? (
                  <p className="text-sm text-muted-foreground">執行日誌將在此顯示</p>
                )
              : (
                  <>
                    {logs.map((log, index) => (
                      <div
                        key={`${log.stepId}-${index}`}
                        className="rounded-md border border-border bg-muted/50 p-3 text-xs"
                      >
                        <div className="mb-1 flex items-center justify-between">
                          <span className="font-medium">{log.stepId}</span>
                          <span className={getStatusColor(log.status)}>
                            {getStatusLabel(log.status)}
                          </span>
                        </div>
                        {log.status === 'running' && (
                          <div className="mt-2 text-[11px] text-muted-foreground">
                            步驟執行中...
                          </div>
                        )}
                        {(log.outputs !== undefined && log.outputs !== null) && (
                          <div className="mt-2">
                            <pre className="overflow-auto rounded bg-background p-2 text-[11px] whitespace-pre-wrap wrap-break-word">
                              {JSON.stringify(sanitizeOutputs(log.outputs), null, 2)}
                            </pre>
                            {hasDynamicFields(log.outputs) && (
                              <p className="mt-1 text-[10px] text-muted-foreground italic">
                                * 標記為 [動態] 的欄位每次執行會不同（如時間戳記、請求 ID 等）
                              </p>
                            )}
                          </div>
                        )}
                        {log.status === 'failure' && !log.outputs && (
                          <div className="mt-2 text-[11px] text-red-600">
                            執行失敗
                          </div>
                        )}
                        <div className="mt-1 text-[10px] text-muted-foreground">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                    <div ref={logsEndRef} />
                  </>
                )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
