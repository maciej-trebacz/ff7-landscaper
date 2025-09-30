import { atom, useAtom } from 'jotai'
import { useStatusBar } from './useStatusBar'
import { useLgpState } from './useLgpState'
import { useAppState } from './useAppState'
import { FieldTblFile } from '@/ff7/fieldtblfile'

export interface FieldEntryInfo {
  x: number
  y: number
  triangle: number
  fieldId: number
  direction: number
}

export interface FieldEntryRecord {
  default: FieldEntryInfo
  alternative: FieldEntryInfo
}

interface LocationsState {
  entries: FieldEntryRecord[]
  file: FieldTblFile | null
  loaded: boolean
}

const locationsStateAtom = atom<LocationsState>({
  entries: [],
  file: null,
  loaded: false,
})

export function useLocationsState() {
  const [state, setState] = useAtom(locationsStateAtom)
  const { setMessage } = useStatusBar()
  const { getFile, setFile } = useLgpState()
  const { markUnsavedChanges, clearUnsavedChanges } = useAppState()

  const loadLocations = async () => {
    try {
      console.log('Loading locations...')
      const data = await getFile('field.tbl')
      if (!data) {
        throw new Error('Failed to read field.tbl')
      }
      const file = new FieldTblFile(data)
      setState({ entries: file.data.entries, file, loaded: true })
    } catch (error) {
      console.error('[Locations] Failed to load field.tbl', error)
      setMessage('Failed to load locations: ' + (error as Error).message, true)
    }
  }

  const updateEntry = (
    index: number,
    scenario: 'default' | 'alternative',
    updates: Partial<FieldEntryInfo>
  ) => {
    setState(prev => {
      if (!prev.entries[index]) return prev
      const entry = prev.entries[index]
      const nextEntry: FieldEntryRecord = {
        default: { ...entry.default },
        alternative: { ...entry.alternative },
      }
      nextEntry[scenario] = { ...nextEntry[scenario], ...updates }

      // Keep underlying file data in sync for straightforward saving
      if (prev.file) {
        prev.file.setEntry(index + 1, nextEntry)
      }

      const nextEntries = [...prev.entries]
      nextEntries[index] = nextEntry
      return { ...prev, entries: nextEntries }
    })
    markUnsavedChanges()
  }

  const copyScenario = (index: number, from: 'default' | 'alternative', to: 'default' | 'alternative') => {
    setState(prev => {
      if (!prev.entries[index]) return prev
      const entry = prev.entries[index]
      const nextEntry: FieldEntryRecord = {
        default: { ...entry.default },
        alternative: { ...entry.alternative },
      }
      nextEntry[to] = { ...nextEntry[from] }
      if (prev.file) {
        prev.file.setEntry(index + 1, nextEntry)
      }
      const nextEntries = [...prev.entries]
      nextEntries[index] = nextEntry
      return { ...prev, entries: nextEntries }
    })
    markUnsavedChanges()
  }

  const saveLocations = async () => {
    try {
      if (!state.file) {
        setMessage('No locations loaded to save', true)
        return
      }
      setMessage('Saving locations...')
      const data = state.file.writeFile()
      await setFile('field.tbl', data)
      console.debug('Locations saved successfully!')
      clearUnsavedChanges()
    } catch (error) {
      console.error('[Locations] Failed to save field.tbl', error)
      setMessage('Failed to save locations: ' + (error as Error).message, true)
    }
  }

  return {
    entries: state.entries,
    loaded: state.loaded,
    loadLocations,
    saveLocations,
    updateEntry,
    copyScenario,
  }
}


