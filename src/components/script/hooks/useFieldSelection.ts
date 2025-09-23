import { useEffect, useState } from "react"
import { loadFieldOptions } from "@/lib/field-options"
import { useLocationsState } from "@/hooks/useLocationsState"
import { fieldsMapping } from "@/ff7/worldscript/constants"

export function useFieldSelection(scenario?: number) {
  const [options, setOptions] = useState<Array<{ id: number; fieldId: number; label: string }>>([])
  const [nameByFieldId, setNameByFieldId] = useState<Record<number, string>>({})
  const { entries, loadLocations } = useLocationsState()

  useEffect(() => {
    let mounted = true
    loadFieldOptions().then(({ byId }) => {
      if (mounted) setNameByFieldId(byId)
    })
    if (!entries || entries.length === 0) {
      loadLocations()
    }
    return () => {
      mounted = false
    }
  }, [entries?.length, loadLocations])

  useEffect(() => {
    if (!entries || entries.length === 0) {
      setOptions([])
      return
    }
    const opts: Array<{ id: number; fieldId: number; label: string }> = entries.map((entry, idx) => {
      const fieldId = scenario === 1 ? entry.alternative.fieldId : entry.default.fieldId
      const sceneLabel = nameByFieldId[fieldId] ?? String(fieldId)
      return { id: idx + 1, fieldId, label: `${idx + 1} - ${sceneLabel}` }
    })
    setOptions(opts)
  }, [entries, nameByFieldId, scenario])

  const getCurrentId = (rawText: string) => {
    let currentId = 0
    const fieldsSlugMatch = rawText.match(/^Fields\.([A-Za-z0-9_]+)$/i)
    if (fieldsSlugMatch && entries && entries.length > 0) {
      const slug = fieldsSlugMatch[1]
      const slugToLocIndex: Record<string, number> = {}
      Object.entries(fieldsMapping).forEach(([locIndex, s]) => {
        slugToLocIndex[s] = Number(locIndex)
      })
      const wantedIndex = slugToLocIndex[slug]
      currentId = wantedIndex && wantedIndex >= 1 && wantedIndex <= (entries?.length ?? 0) ? wantedIndex : 0
    } else {
      currentId = parseInt(rawText || "0", 10) || 0
    }
    return currentId
  }

  const handleValueChange = (
    value: string,
    onBatch: (updates: Array<{ index: number; newText: string }>) => void,
    paramIndex: number = 0
  ) => {
    const idx = parseInt(value, 10)
    const slug = (fieldsMapping as any)[idx]
    const newText = slug ? `Fields.${slug}` : String(idx)
    onBatch([{ index: paramIndex, newText }])
  }

  return { options, entries, getCurrentId, handleValueChange }
}

