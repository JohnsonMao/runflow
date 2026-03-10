import type { FlowDetail, FlowGraph, FlowGraphResponse } from '../types'
import { useEffect, useRef, useState } from 'react'
import { initialParamValuesFromDetail } from '../lib/params'

interface UseFlowGraphResult {
  graph: FlowGraph | null
  setGraph: React.Dispatch<React.SetStateAction<FlowGraph | null>>
  graphLoading: boolean
  graphError: string | null
  flowDetail: FlowDetail | null
  setFlowDetail: React.Dispatch<React.SetStateAction<FlowDetail | null>>
  paramValues: Record<string, unknown>
  setParamValues: React.Dispatch<React.SetStateAction<Record<string, unknown>>>
  isInitialized: boolean
}

export function useFlowGraph(selectedFlowId: string | null): UseFlowGraphResult {
  const [graph, setGraph] = useState<FlowGraph | null>(null)
  const [graphLoading, setGraphLoading] = useState(false)
  const [graphError, setGraphError] = useState<string | null>(null)
  const [flowDetail, setFlowDetail] = useState<FlowDetail | null>(null)
  const [paramValues, setParamValues] = useState<Record<string, unknown>>({})
  const [isInitialized, setIsInitialized] = useState(false)
  const fetchingFlowIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!selectedFlowId) {
      setGraphError(null)
      fetchingFlowIdRef.current = null
      setIsInitialized(false)
      return
    }
    const flowIdForThisFetch = selectedFlowId
    fetchingFlowIdRef.current = flowIdForThisFetch
    setGraphError(null)
    setGraph(null)
    setFlowDetail(null)

    const wsUrl = new URLSearchParams(window.location.search).get('ws')
    if (wsUrl) {
      // In dev mode with WS, skip API fetch and wait for FLOW_RELOAD via WS
      setGraphLoading(false)
      setIsInitialized(true)
      return
    }

    // Do NOT reset paramValues to {} here to avoid clearing URL params in App.tsx sync effect
    // Instead, we mark as not initialized
    setIsInitialized(false)
    setGraphLoading(true)
    fetch(`/api/workspace/graph?flowId=${encodeURIComponent(selectedFlowId)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok)
          throw new Error(data?.error ?? `Graph failed: ${res.status}`)
        return data as FlowGraphResponse
      })
      .then((response) => {
        if (fetchingFlowIdRef.current !== flowIdForThisFetch)
          return
        const graphData: FlowGraph = {
          nodes: response.nodes ?? [],
          edges: response.edges ?? [],
          flowName: response.flowName,
          flowDescription: response.flowDescription,
        }
        if (graphData.nodes.length > 0)
          setGraph(graphData)
        else
          setGraph(null)
        const detail: FlowDetail = {
          flowId: response.flowId ?? flowIdForThisFetch,
          name: response.flowName ?? flowIdForThisFetch,
          description: response.flowDescription,
          params: response.params,
          steps: response.steps,
          handlerKey: response.handlerKey,
          path: response.path,
        }
        setFlowDetail(detail)

        // Initialize param values: merge defaults with URL params if available (only on first load of this flow)
        const defaults = initialParamValuesFromDetail(detail)
        const urlParamsStr = new URLSearchParams(window.location.search).get('params')
        if (urlParamsStr) {
          try {
            const parsed = JSON.parse(urlParamsStr)
            setParamValues({ ...defaults, ...parsed })
          }
          catch {
            setParamValues(defaults)
          }
        }
        else {
          setParamValues(defaults)
        }
        setIsInitialized(true)
      })
      .catch((err: unknown) => {
        if (fetchingFlowIdRef.current !== flowIdForThisFetch)
          return
        setGraphError(err instanceof Error ? err.message : 'Failed to load graph')
        setGraph(null)
        setFlowDetail(null)
        fetch(`/api/workspace/detail?flowId=${encodeURIComponent(flowIdForThisFetch)}`)
          .then(async (res) => {
            if (fetchingFlowIdRef.current !== flowIdForThisFetch)
              return
            const data = await res.json().catch(() => ({}))
            if (!res.ok)
              return
            const detail = data as FlowDetail
            setFlowDetail(detail)

            const defaults = initialParamValuesFromDetail(detail)
            const urlParamsStr = new URLSearchParams(window.location.search).get('params')
            if (urlParamsStr) {
              try {
                const parsed = JSON.parse(urlParamsStr)
                setParamValues({ ...defaults, ...parsed })
              }
              catch {
                setParamValues(defaults)
              }
            }
            else {
              setParamValues(defaults)
            }
            setIsInitialized(true)
          })
          .catch(() => {})
      })
      .finally(() => {
        if (fetchingFlowIdRef.current === flowIdForThisFetch)
          setGraphLoading(false)
      })
  }, [selectedFlowId])

  useEffect(() => {
    if (!selectedFlowId) {
      setFlowDetail(null)
      setParamValues({})
      setIsInitialized(false)
    }
  }, [selectedFlowId])

  return {
    graph,
    setGraph,
    graphLoading,
    graphError,
    flowDetail,
    setFlowDetail,
    paramValues,
    setParamValues,
    isInitialized,
  }
}
