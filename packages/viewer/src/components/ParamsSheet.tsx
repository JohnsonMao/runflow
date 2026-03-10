import type { FlowDetail, ParamDeclaration } from '../types'
import { Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { useIsMobile } from '../hooks/use-mobile'
import { ParamsForm } from './ParamsForm'

interface ParamsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  flowDetail: FlowDetail | null
  paramValues: Record<string, unknown>
  onParamChange: (path: string, value: unknown) => void
}

function countInteractiveFields(params: ParamDeclaration[]): number {
  return params.reduce((sum, p) => {
    if (p.type === 'object' && p.schema && Object.keys(p.schema).length > 0)
      return sum + Object.keys(p.schema).length
    return sum + 1
  }, 0)
}

function sheetDescription(flowDetail: FlowDetail | null, fieldCount: number): string {
  if (!flowDetail)
    return '載入中…'
  if (fieldCount > 0)
    return `填寫 ${fieldCount} 個欄位`
  return '此 flow 無參數'
}

export function ParamsSheet({
  open,
  onOpenChange,
  flowDetail,
  paramValues,
  onParamChange,
}: ParamsSheetProps): React.ReactElement {
  const isMobile = useIsMobile()
  const params = flowDetail?.params ?? []
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" className="gap-2">
          <Settings2 className="size-4" aria-hidden />
          設置 Params
        </Button>
      </SheetTrigger>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'flex flex-col sm:max-w-96',
          isMobile && 'max-h-[85dvh]',
        )}
      >
        <SheetHeader>
          <SheetTitle>設置 Params</SheetTitle>
          <SheetDescription>
            {sheetDescription(flowDetail, countInteractiveFields(params))}
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {params.length > 0
            ? <ParamsForm params={params} paramValues={paramValues} onParamChange={onParamChange} />
            : flowDetail && <p className="text-sm text-muted-foreground">無需填寫參數</p>}
        </div>
      </SheetContent>
    </Sheet>
  )
}
