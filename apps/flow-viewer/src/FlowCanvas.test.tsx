import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from 'reactflow'
import { describe, expect, it } from 'vitest'
import { FlowCanvas } from './FlowCanvas'

const minimalGraph = {
  nodes: [
    { id: 'a', label: 'Start', shape: 'start' as const },
    { id: 'b', label: 'Step', shape: 'process' as const },
    { id: 'c', label: 'End', shape: 'end' as const },
  ],
  edges: [
    { source: 'a', target: 'b' },
    { source: 'b', target: 'c' },
  ],
}

describe('flowCanvas', () => {
  it('renders without crashing and shows node labels', () => {
    render(
      <ReactFlowProvider>
        <FlowCanvas graph={minimalGraph} />
      </ReactFlowProvider>,
    )
    expect(screen.getByText('Start')).toBeTruthy()
    expect(screen.getByText('Step')).toBeTruthy()
    expect(screen.getByText('End')).toBeTruthy()
  })
})
