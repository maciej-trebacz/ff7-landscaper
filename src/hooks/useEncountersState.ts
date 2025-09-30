import { atom, useAtom } from 'jotai'
import { useStatusBar } from './useStatusBar'
import { useLgpState } from './useLgpState'
import { useAppState } from './useAppState'
import { readFile, writeFile } from "@tauri-apps/plugin-fs"
import { EncWFile, EncWData, EncounterSet, EncounterPair, YuffieEncounter, ChocoboRating } from '@/ff7/encwfile'
import { FF7ExeFile, FF7ExeData } from '@/ff7/ff7exefile'

interface EncountersState {
  file: EncWFile | null
  data: EncWData | null
  exeFile: FF7ExeFile | null
  exeData: FF7ExeData | null
  loaded: boolean
}

const encountersStateAtom = atom<EncountersState>({
  file: null,
  data: null,
  exeFile: null,
  exeData: null,
  loaded: false,
})

async function readEncW(getFile: (name: string) => Promise<Uint8Array | null>): Promise<Uint8Array> {
  // Try common filename variants just in case
  const candidates = ['enc_w.bin', 'enc_w.BIN', 'ENC_W.BIN']
  for (const name of candidates) {
    const buf = await getFile(name)
    if (buf) return buf
  }
  throw new Error('enc_w.bin not found in world_us.lgp')
}

export function useEncountersState() {
  const [state, setState] = useAtom(encountersStateAtom)
  const { setMessage } = useStatusBar()
  const { getFile, setFile } = useLgpState()
  const { dataPath, markUnsavedChanges, clearUnsavedChanges } = useAppState()

  const loadEncounters = async () => {
    try {
      console.debug('Loading encounters...')
      const data = await readEncW(getFile)
      const file = new EncWFile(data)
      setState(prev => ({ ...prev, file, data: file.data, loaded: true }))
    } catch (error) {
      console.error('[Encounters] Failed to load enc_w.bin', error)
      setMessage('Failed to load encounters: ' + (error as Error).message, true)
    }
  }

  const saveEncounters = async () => {
    try {
      if (!state.file) {
        setMessage('No encounters loaded to save', true)
        return
      }
      setMessage('Saving encounters...')
      const data = state.file.writeFile()
      await setFile('enc_w.bin', data)
      console.debug('Encounters saved successfully!')
      clearUnsavedChanges()
    } catch (error) {
      console.error('[Encounters] Failed to save enc_w.bin', error)
      setMessage('Failed to save encounters: ' + (error as Error).message, true)
    }
  }

  const updateYuffie = (index: number, updates: Partial<YuffieEncounter>) => {
    setState(prev => {
      if (!prev.file || !prev.data) return prev

      // Create a deep copy of the data and update it
      const newData = structuredClone(prev.data)
      newData.yuffieEncounters[index] = { ...newData.yuffieEncounters[index], ...updates }

      // Keep underlying file data in sync for straightforward saving
      const updatedEntry = newData.yuffieEncounters[index]
      prev.file.setYuffieEncounter(index, updatedEntry)

      return {
        ...prev,
        data: newData
      }
    })
    markUnsavedChanges()
  }

  const updateChocobo = (index: number, updates: Partial<ChocoboRating>) => {
    setState(prev => {
      if (!prev.file || !prev.data) return prev

      // Create a deep copy of the data and update it
      const newData = structuredClone(prev.data)
      newData.chocoboRatings[index] = { ...newData.chocoboRatings[index], ...updates } as ChocoboRating

      // Keep underlying file data in sync for straightforward saving
      const updatedEntry = newData.chocoboRatings[index]
      prev.file.setChocoboRating(index, updatedEntry)

      return {
        ...prev,
        data: newData
      }
    })
    markUnsavedChanges()
  }

  const updateEncounterMeta = (
    regionIndex: number,
    setIndex: number,
    updates: Partial<Pick<EncounterSet, 'active' | 'encounterRate'>>
  ) => {
    setState(prev => {
      if (!prev.file || !prev.data) return prev

      // Create a deep copy of the data
      const newData = structuredClone(prev.data)

      // Update the specific encounter set in the new data
      const currentSet = newData.randomEncounters.regions[regionIndex].sets[setIndex]
      const updatedSet = { ...currentSet, ...updates } as EncounterSet
      newData.randomEncounters.regions[regionIndex].sets[setIndex] = updatedSet

      // Keep underlying file data in sync for straightforward saving
      prev.file.setEncounterSet(regionIndex, setIndex, updatedSet)

      return {
        ...prev,
        data: newData
      }
    })
    markUnsavedChanges()
  }

  const updateEncounterPair = (
    regionIndex: number,
    setIndex: number,
    group: 'normal' | 'back' | 'side' | 'pincer' | 'chocobo',
    indexInGroup: number | null,
    updates: Partial<EncounterPair>
  ) => {
    setState(prev => {
      if (!prev.file || !prev.data) return prev

      // Create a deep copy of the data
      const newData = structuredClone(prev.data)
      const set = newData.randomEncounters.regions[regionIndex].sets[setIndex]

      if (group === 'normal' && indexInGroup != null) {
        set.normalEncounters[indexInGroup] = { ...set.normalEncounters[indexInGroup], ...updates }
      } else if (group === 'back' && indexInGroup != null) {
        set.backAttacks[indexInGroup] = { ...set.backAttacks[indexInGroup], ...updates }
      } else if (group === 'side') {
        set.sideAttack = { ...set.sideAttack, ...updates }
      } else if (group === 'pincer') {
        set.pincerAttack = { ...set.pincerAttack, ...updates }
      } else if (group === 'chocobo' && indexInGroup != null) {
        set.chocoboEncounters[indexInGroup] = { ...set.chocoboEncounters[indexInGroup], ...updates }
      }

      // Keep underlying file data in sync for straightforward saving
      const updatedSet = newData.randomEncounters.regions[regionIndex].sets[setIndex]
      prev.file.setEncounterSet(regionIndex, setIndex, updatedSet)

      return {
        ...prev,
        data: newData
      }
    })
    markUnsavedChanges()
  }

  const loadExeFile = async () => {
    try {
      console.log('Loading FF7 executable...')
      const path = `${dataPath}/ff7_en.exe`
      const fileData = await readFile(path)
      const exeFile = new FF7ExeFile(fileData)
      setState(prev => ({ ...prev, exeFile, exeData: exeFile.data }))
      setMessage('FF7 executable loaded successfully!')
    } catch (error) {
      console.error('[EXE] Failed to load ff7_en.exe', error)
      setMessage('Failed to load FF7 executable: ' + (error as Error).message, true)
    }
  }

  const saveExeFile = async () => {
    try {
      if (!state.exeFile) {
        setMessage('No FF7 executable loaded to save', true)
        return
      }
      const path = `${dataPath}/ff7_en.exe`
      const data = state.exeFile.writeFile()
      await writeFile(path, data)
      console.debug('FF7 executable saved successfully!')
      clearUnsavedChanges()
    } catch (error) {
      console.error('[EXE] Failed to save ff7_en.exe', error)
      setMessage('Failed to save FF7 executable: ' + (error as Error).message, true)
    }
  }

  const updateTerrainRegion = (
    regionIndex: number,
    terrainIndex: number,
    value: number
  ) => {
    setState(prev => {
      if (!prev.exeFile || !prev.exeData) return prev

      // Create a deep copy of the data and update it
      const newData = structuredClone(prev.exeData)
      newData.terrainRegions[regionIndex].terrainTypes[terrainIndex] = value

      // Keep underlying file data in sync for straightforward saving
      prev.exeFile.setTerrainType(regionIndex, terrainIndex, value)

      return {
        ...prev,
        exeData: newData
      }
    })
    markUnsavedChanges()
  }

  const updateTerrainRegionBulk = (
    regionIndex: number,
    terrainTypes: number[]
  ) => {
    setState(prev => {
      if (!prev.exeFile || !prev.exeData) return prev

      // Create a deep copy of the data and update it
      const newData = structuredClone(prev.exeData)
      newData.terrainRegions[regionIndex] = { terrainTypes }

      // Keep underlying file data in sync for straightforward saving
      terrainTypes.forEach((value, terrainIndex) => {
        prev.exeFile.setTerrainType(regionIndex, terrainIndex, value)
      })

      return {
        ...prev,
        exeData: newData
      }
    })
    markUnsavedChanges()
  }

  return {
    data: state.data,
    exeData: state.exeData,
    loaded: state.loaded,
    loadEncounters,
    saveEncounters,
    loadExeFile,
    saveExeFile,
    updateYuffie,
    updateChocobo,
    updateEncounterMeta,
    updateEncounterPair,
    updateTerrainRegion,
    updateTerrainRegionBulk,
  }
}


