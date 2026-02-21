import type { TreeResponse, WorkspaceStatus } from '../types'
import { useEffect, useState } from 'react'

export function useWorkspace(): {
  workspaceStatus: WorkspaceStatus | null
  treeResponse: TreeResponse | null
  treeError: string | null
} {
  const [workspaceStatus, setWorkspaceStatus] = useState<WorkspaceStatus | null>(null)
  const [treeResponse, setTreeResponse] = useState<TreeResponse | null>(null)
  const [treeError, setTreeError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/workspace/status')
      .then(res => res.json())
      .then((data: WorkspaceStatus) => setWorkspaceStatus(data))
      .catch(() => setWorkspaceStatus(null))
  }, [])

  useEffect(() => {
    if (!workspaceStatus?.configured) {
      setTreeResponse(null)
      setTreeError(null)
      return
    }
    setTreeError(null)
    fetch('/api/workspace/tree')
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body?.error ?? `Tree failed: ${res.status}`)
        }
        return res.json() as Promise<TreeResponse>
      })
      .then(setTreeResponse)
      .catch((err: unknown) => setTreeError(err instanceof Error ? err.message : 'Failed to load tree'))
  }, [workspaceStatus?.configured])

  return { workspaceStatus, treeResponse, treeError }
}
