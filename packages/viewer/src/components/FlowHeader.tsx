import { Moon, Play, Settings2, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface FlowHeaderProps {
  workspaceHint: string
  flowName?: string
  selectedFlowId: string | null
  executionPanelOpen: boolean
  setExecutionPanelOpen: (open: boolean) => void
  runLoading: boolean
  onRun: () => void
  dark: boolean
  setDark: (value: boolean | ((prev: boolean) => boolean)) => void
}

export function FlowHeader({
  workspaceHint,
  flowName,
  selectedFlowId,
  executionPanelOpen,
  setExecutionPanelOpen,
  runLoading,
  onRun,
  dark,
  setDark,
}: FlowHeaderProps): React.ReactElement {
  return (
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-background px-3 py-2">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <SidebarTrigger aria-label="Toggle sidebar" className="shrink-0" />
        <h1 className="m-0 shrink-0 text-base font-semibold tracking-tight">Flow Viewer</h1>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-help shrink-0 truncate text-xs text-muted-foreground underline decoration-dotted underline-offset-2 max-sm:max-w-[80px]">
              Workspace
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[90vw] break-all font-mono text-[11px]">
            {workspaceHint}
          </TooltipContent>
        </Tooltip>
        {flowName && (
          <span className="shrink-0 truncate text-sm text-muted-foreground max-sm:max-w-[100px]" title={flowName}>
            {flowName}
          </span>
        )}
      </div>
      <div className="grow flex flex-wrap justify-between gap-2">
        {selectedFlowId && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setExecutionPanelOpen(!executionPanelOpen)}
              className="shrink-0 gap-2"
            >
              <Settings2 className="size-4" aria-hidden />
              執行面板
            </Button>
            <Button
              type="button"
              onClick={onRun}
              disabled={runLoading}
              className="shrink-0 gap-2"
            >
              <Play className="size-4" aria-hidden />
              {runLoading ? '執行中…' : '執行'}
            </Button>
          </div>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 ml-auto"
          onClick={() => setDark(d => !d)}
          aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          <span className="sr-only">{dark ? 'Switch to light mode' : 'Switch to dark mode'}</span>
        </Button>
      </div>
    </header>
  )
}
