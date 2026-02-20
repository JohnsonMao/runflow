import type { ParamDeclaration } from '@runflow/core'
import type { DiscoverEntry } from './discover'

function formatOneParam(p: ParamDeclaration, indent = ''): string[] {
  const lines: string[] = []
  const req = p.required === true ? ', required' : ''
  const desc = p.description ? ` — ${p.description.replace(/\n/g, ' ')}` : ''
  lines.push(`${indent}- **${p.name}** (${p.type}${req})${desc}`)
  if (p.type === 'object' && p.schema && Object.keys(p.schema).length > 0) {
    for (const [k, v] of Object.entries(p.schema)) {
      const req2 = v.required === true ? ', required' : ''
      const desc2 = v.description ? ` — ${v.description.replace(/\n/g, ' ')}` : ''
      lines.push(`${indent}  - **${k}** (${v.type}${req2})${desc2}`)
    }
  }
  return lines
}

function formatParamsSummary(params: ParamDeclaration[] | undefined): string {
  if (!params?.length)
    return ''
  return params.flatMap(p => formatOneParam(p)).join('\n')
}

function escapeTableCell(s: string): string {
  return s.replace(/\n/g, ' ').replace(/\|/g, '\\|')
}

export function formatListAsMarkdown(entries: DiscoverEntry[], limit: number, offset: number): string {
  const total = entries.length
  const slice = entries.slice(offset, offset + limit)
  if (slice.length === 0)
    return total === 0 ? 'No flows found.' : `Total: ${total} flows. No flows in this range (offset ${offset}).`
  const start = offset + 1
  const end = offset + slice.length
  const rangeLine = `Total: ${total} flows. Showing ${start}-${end}.\n\n`
  const header = '| flowId | name |'
  const separator = '| --- | --- |'
  const rows = slice.map(e => `| ${escapeTableCell(e.flowId)} | ${escapeTableCell(e.name ?? '')} |`)
  const table = [header, separator, ...rows].join('\n')
  const hasMore = offset + limit < total
  const nextOffset = offset + limit
  const paginationHint = hasMore ? `\n\nNext: offset=${nextOffset}` : ''
  return `${rangeLine}${table}${paginationHint}`
}

function formatStepsSummary(steps: DiscoverEntry['steps']): string {
  if (!steps?.length)
    return ''
  const lines = steps.map((s) => {
    const namePart = s.name ? ` — ${escapeTableCell(s.name)}` : ''
    const descPart = s.description ? `\n    ${escapeTableCell(s.description).replace(/\\n/g, '\n    ')}` : ''
    return `  - **${s.id}**${s.type ? ` (${s.type})` : ''}${namePart}${descPart}`
  })
  return `- **steps**:\n${lines.join('\n')}`
}

export function formatDetailAsMarkdown(entry: DiscoverEntry): string {
  const flowId = entry.flowId.replace(/\n/g, ' ')
  const name = (entry.name ?? '').replace(/\n/g, ' ')
  const desc = (entry.description ?? '').replace(/\n/g, ' ')
  const paramsBlock = formatParamsSummary(entry.params)
  const parts = [
    `- **flowId**: ${flowId}`,
    `- **name**: ${name}`,
    `- **description**: ${desc}`,
  ]
  if (paramsBlock)
    parts.push(`- **params**:\n${paramsBlock.split('\n').map(l => `  ${l}`).join('\n')}`)
  const stepsBlock = formatStepsSummary(entry.steps)
  if (stepsBlock)
    parts.push(stepsBlock)
  return parts.join('\n')
}
