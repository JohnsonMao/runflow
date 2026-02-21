import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface ResultDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  result: string | null
}

export function ResultDialog({ open, onOpenChange, result }: ResultDialogProps): React.ReactElement {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showClose className="max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>執行結果</DialogTitle>
        </DialogHeader>
        <pre className="min-h-0 flex-1 overflow-auto rounded-md border border-border bg-muted/50 p-3 text-xs whitespace-pre-wrap wrap-break-word">
          {result ?? ''}
        </pre>
      </DialogContent>
    </Dialog>
  )
}
