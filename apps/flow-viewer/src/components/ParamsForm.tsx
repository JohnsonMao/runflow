import type { ParamDeclaration, ParamSchemaProperty } from '../types'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { getNested } from '../lib/nested'

interface ParamsFormProps {
  params: ParamDeclaration[]
  paramValues: Record<string, unknown>
  onParamChange: (path: string, value: unknown) => void
}

interface ParamFieldProps {
  path: string
  prop: ParamSchemaProperty | ParamDeclaration
  label: string
  required?: boolean
  value: unknown
  onParamChange: (path: string, value: unknown) => void
}

function ParamField({ path, prop, label, required, value, onParamChange }: ParamFieldProps): React.ReactElement {
  const id = `param-${path.replace(/\./g, '-')}`
  if (prop.type === 'boolean') {
    return (
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
          {required === true && <span className="text-destructive"> *</span>}
        </label>
        <Switch
          id={id}
          checked={value === true || value === 'true'}
          onCheckedChange={v => onParamChange(path, v)}
          aria-label={label}
        />
      </div>
    )
  }
  const hasEnum = 'enum' in prop && Array.isArray(prop.enum) && prop.enum.length > 0
  if (hasEnum) {
    const EMPTY_VALUE = '__none__'
    const options = prop.enum as unknown[]
    const strValue = value != null ? String(value) : ''
    const match = options.find(opt => String(opt) === strValue)
    const selectValue = match !== undefined ? String(match) : ''
    const valueForSelect = value == null && !required ? EMPTY_VALUE : (selectValue || undefined)
    return (
      <div className="min-w-0 space-y-1.5">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
          {required === true && <span className="text-destructive"> *</span>}
        </label>
        <Select
          value={valueForSelect}
          onValueChange={(str) => {
            if (str === EMPTY_VALUE)
              onParamChange(path, undefined)
            else
              onParamChange(path, options.find(opt => String(opt) === str))
          }}
        >
          <SelectTrigger id={id} className="h-9 w-full min-w-0">
            <SelectValue placeholder={prop.description ?? undefined} />
          </SelectTrigger>
          <SelectContent>
            {!required && (
              <SelectItem value={EMPTY_VALUE}>
                （不選）
              </SelectItem>
            )}
            {options.map(opt => (
              <SelectItem key={String(opt)} value={String(opt)}>
                {String(opt)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  }
  if (prop.type === 'number') {
    let numVal: number | undefined
    if (typeof value === 'number')
      numVal = value
    else if (value != null && value !== '')
      numVal = Number(value)
    else
      numVal = undefined
    return (
      <div className="space-y-1.5">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
          {required === true && <span className="text-destructive"> *</span>}
        </label>
        <Input
          id={id}
          type="number"
          value={numVal === undefined ? '' : numVal}
          onChange={e => onParamChange(path, e.target.value === '' ? undefined : Number(e.target.value))}
          placeholder={prop.description ?? undefined}
          className="h-9"
        />
      </div>
    )
  }
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {required === true && <span className="text-destructive"> *</span>}
      </label>
      <Input
        id={id}
        type="text"
        value={value != null ? String(value) : ''}
        onChange={e => onParamChange(path, e.target.value || undefined)}
        placeholder={prop.description ?? undefined}
        className="h-9"
      />
    </div>
  )
}

function ParamControl({
  param,
  onParamChange,
  getNestedValue,
}: {
  param: ParamDeclaration
  onParamChange: (path: string, value: unknown) => void
  getNestedValue: (path: string) => unknown
}): React.ReactElement {
  if (param.type === 'object' && param.schema && Object.keys(param.schema).length > 0) {
    return (
      <fieldset className="space-y-3 rounded-md border border-border p-3">
        <legend className="text-sm font-medium">
          {param.name}
          {param.description
            ? (
                <span className="ml-1 font-normal text-muted-foreground">
                  —
                  {' '}
                  {param.description}
                </span>
              )
            : null}
        </legend>
        <div className="flex flex-col w-80 gap-3">
          {Object.entries(param.schema).map(([key, prop]) => (
            <ParamField
              key={`${param.name}.${key}`}
              path={`${param.name}.${key}`}
              prop={prop}
              label={key}
              required={prop.required}
              value={getNestedValue(`${param.name}.${key}`)}
              onParamChange={onParamChange}
            />
          ))}
        </div>
      </fieldset>
    )
  }
  return (
    <div className="w-80">
      <ParamField
        path={param.name}
        prop={param}
        label={param.name}
        required={param.required}
        value={getNestedValue(param.name)}
        onParamChange={onParamChange}
      />
    </div>
  )
}

export function ParamsForm({ params, paramValues, onParamChange }: ParamsFormProps): React.ReactElement {
  const getNestedValue = (path: string) => getNested(paramValues, path)
  return (
    <div className="flex flex-col gap-4">
      {params.map(p => (
        <ParamControl
          key={p.name}
          param={p}
          onParamChange={onParamChange}
          getNestedValue={getNestedValue}
        />
      ))}
    </div>
  )
}
