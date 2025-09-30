import { useEffect, useRef, useState } from 'react'
import { useLocationsState } from '@/hooks/useLocationsState'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { loadFieldOptions } from '@/lib/field-options'
import { ChevronDown } from 'lucide-react'
import { createPortal } from 'react-dom'

function NumberInput({
  value,
  onChange,
  min,
  max,
  className,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  className?: string
}) {
  return (
    <Input
      type="number"
      className={className}
      value={Number.isFinite(value) ? value : ''}
      min={min}
      max={max}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  )
}

function FieldTrigger({ label, onOpen }: { label: string; onOpen: (rect: DOMRect, width: number) => void }) {
  const ref = useRef<HTMLButtonElement | null>(null)
  return (
    <button
      ref={ref}
      type="button"
      className="relative h-8 w-full rounded-md border border-input bg-transparent px-3 pr-8 text-left text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      onClick={(e) => {
        const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
        onOpen(rect, (e.currentTarget as HTMLButtonElement).offsetWidth)
      }}
    >
      <span className="truncate block">{label}</span>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" />
    </button>
  )
}

function FieldDropdown({ 
  rect, 
  width, 
  fieldOptions, 
  onSelect, 
  onClose 
}: { 
  rect: DOMRect
  width: number
  fieldOptions: Array<{ id: number; label: string }>
  onSelect: (id: number) => void
  onClose: () => void 
}) {
  const [filter, setFilter] = useState('')

  useEffect(() => {
    const handler = () => {
      onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', handler)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', handler)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const CONTAINER_MAX_HEIGHT = 320
  const HEADER_HEIGHT = 42
  const LIST_MAX_HEIGHT = CONTAINER_MAX_HEIGHT - HEADER_HEIGHT

  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
  const top = Math.min(rect.bottom + 4, window.innerHeight - (CONTAINER_MAX_HEIGHT + 8))
  const filtered = filter ? fieldOptions.filter(o => o.label.toLowerCase().includes(filter.toLowerCase())) : fieldOptions

  return createPortal(
    <div className="fixed inset-0 z-50" style={{ pointerEvents: 'none' }}>
      <div
        className="fixed rounded-md border border-zinc-800 bg-zinc-900 text-zinc-100 shadow-xl ring-1 ring-black/10"
        style={{ left, top, width, maxHeight: CONTAINER_MAX_HEIGHT, pointerEvents: 'auto' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          className="absolute -top-2 left-4 w-0 h-0"
          style={{
            borderLeft: '8px solid transparent',
            borderRight: '8px solid transparent',
            borderBottom: '8px solid rgb(24 24 27)',
            filter: 'drop-shadow(0 1px 0 rgba(0,0,0,0.25))'
          }}
        />

        <div className="p-1 border-b border-zinc-800 bg-zinc-900/95 sticky top-0">
          <Input
            autoFocus
            placeholder="Filter..."
            className="h-8"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
          />
        </div>
        <div className="overflow-auto p-1" style={{ maxHeight: LIST_MAX_HEIGHT }}>
          {filtered.map(opt => (
            <button
              key={opt.id}
              type="button"
              className="w-full text-left px-2 py-1.5 rounded hover:bg-zinc-800 text-sm"
              onClick={() => { onSelect(opt.id); onClose() }}
            >
              {opt.label}
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="px-2 py-2 text-sm text-zinc-400">No results</div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

export function LocationsTab() {
  const { entries, loaded, updateEntry } = useLocationsState()

  const [fieldOptions, setFieldOptions] = useState<Array<{ id: number; label: string }>>([])
  const [labelById, setLabelById] = useState<Record<number, string>>({})
  useEffect(() => {
    let mounted = true
    loadFieldOptions().then(({ options, byId }) => { if (mounted) { setFieldOptions(options); setLabelById(byId) } })
    return () => { mounted = false }
  }, [])

  type DropdownState = null | { rect: DOMRect; width: number; onSelect: (id: number) => void }
  const [dropdown, setDropdown] = useState<DropdownState>(null)


  if (!loaded) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Loading locations...
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <ScrollArea className="flex-1">
        <div className="min-w-[1000px]">
          <div className="grid gap-x-1 grid-cols-[64px_92px_92px_76px_minmax(140px,1fr)_76px_1px_92px_92px_76px_minmax(140px,1fr)_76px] px-3 py-2 text-[11px] uppercase tracking-wide text-zinc-400 sticky top-0 bg-background z-20">
            <div className="col-span-1" />
            <div className="col-span-5">Default</div>
            <div/>
            <div className="col-span-5">Alternative</div>
          </div>
          <div className="grid gap-x-1 grid-cols-[64px_92px_92px_76px_minmax(140px,1fr)_76px_1px_92px_92px_76px_minmax(140px,1fr)_76px] px-3 pb-2 text-[11px] uppercase tracking-wide text-zinc-400 sticky top-8 bg-background z-10">
            <div>ID</div>
            <div>X</div>
            <div>Y</div>
            <div>Triangle</div>
            <div>Field ID</div>
            <div>Direction</div>
            <div/>
            <div>X</div>
            <div>Y</div>
            <div>Triangle</div>
            <div>Field ID</div>
            <div>Direction</div>
          </div>

          <div className="divide-y">
            {entries.map((entry, i) => (
              <div key={i} className="grid gap-x-1 grid-cols-[64px_92px_92px_76px_minmax(140px,1fr)_76px_1px_92px_92px_76px_minmax(140px,1fr)_76px] items-center px-3 py-2 hover:bg-zinc-900/40 odd:bg-zinc-900/20">
                <div className="text-sm text-zinc-300">{i + 1}</div>
                <NumberInput value={entry.default.x} onChange={(v) => updateEntry(i, 'default', { x: v })} className="h-8 w-full text-sm" min={-32768} max={32767} />
                <NumberInput value={entry.default.y} onChange={(v) => updateEntry(i, 'default', { y: v })} className="h-8 w-full text-sm" min={-32768} max={32767} />
                <NumberInput value={entry.default.triangle} onChange={(v) => updateEntry(i, 'default', { triangle: v })} className="h-8 w-full text-sm" min={0} max={65535} />
                <FieldTrigger
                  label={labelById[entry.default.fieldId] ?? String(entry.default.fieldId)}
                  onOpen={(rect, width) => setDropdown({ rect, width, onSelect: (id) => updateEntry(i, 'default', { fieldId: id }) })}
                />
                <NumberInput value={entry.default.direction} onChange={(v) => updateEntry(i, 'default', { direction: v })} className="h-8 w-full text-sm" min={0} max={255} />
                <div className="bg-zinc-800 h-full" />
                <NumberInput value={entry.alternative.x} onChange={(v) => updateEntry(i, 'alternative', { x: v })} className="h-8 w-full text-sm" min={-32768} max={32767} />
                <NumberInput value={entry.alternative.y} onChange={(v) => updateEntry(i, 'alternative', { y: v })} className="h-8 w-full text-sm" min={-32768} max={32767} />
                <NumberInput value={entry.alternative.triangle} onChange={(v) => updateEntry(i, 'alternative', { triangle: v })} className="h-8 w-full text-sm" min={0} max={65535} />
                <FieldTrigger
                  label={labelById[entry.alternative.fieldId] ?? String(entry.alternative.fieldId)}
                  onOpen={(rect, width) => setDropdown({ rect, width, onSelect: (id) => updateEntry(i, 'alternative', { fieldId: id }) })}
                />
                <NumberInput value={entry.alternative.direction} onChange={(v) => updateEntry(i, 'alternative', { direction: v })} className="h-8 w-full text-sm" min={0} max={255} />
              </div>
            ))}
          </div>
        </div>
        {dropdown && (
          <FieldDropdown
            rect={dropdown.rect}
            width={dropdown.width}
            fieldOptions={fieldOptions}
            onSelect={dropdown.onSelect}
            onClose={() => setDropdown(null)}
          />
        )}
      </ScrollArea>
    </div>
  )
}


