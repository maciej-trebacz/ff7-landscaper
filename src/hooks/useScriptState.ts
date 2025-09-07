import { atom, useAtom } from "jotai"
import { useStatusBar } from "./useStatusBar"
import { useLgpState } from "./useLgpState"
import { MapId } from "./useMapState"
import { EvFile, FF7Function, FunctionType, SystemFunction, ModelFunction, MeshFunction } from "@/ff7/evfile"
import { Worldscript } from "@/ff7/worldscript/worldscript"

interface SelectedScript {
  type: FunctionType
  id: number
  modelId?: number
  aliasId?: number
  x?: number
  y?: number
}

interface ScriptsState {
  functions: FF7Function[]
  selectedMap: MapId
  scriptType: FunctionType
  selectedScript: SelectedScript | null
  ev: EvFile | null
  decompiled: boolean
  decompiledScripts: Record<string, string> // Map of script keys to decompiled content
  scriptHistory: SelectedScript[] // History of opened scripts for back/forward navigation
  currentHistoryIndex: number // Current position in history (-1 means no history)
  loaded: boolean
}

const scriptsStateAtom = atom<ScriptsState>({
  functions: [],
  selectedMap: "WM0",
  scriptType: FunctionType.System,
  selectedScript: null,
  ev: null,
  decompiled: true,
  decompiledScripts: {},
  scriptHistory: [],
  currentHistoryIndex: -1,
  loaded: false,
})

export function useScriptsState() {
  const [state, setState] = useAtom(scriptsStateAtom)
  const { setMessage } = useStatusBar()
  const { getFile, setFile } = useLgpState()

  const loadScripts = async (mapId?: MapId): Promise<FF7Function[] | undefined> => {
    try {
      // Clear existing scripts first
      setState((prev) => ({
        ...prev,
        functions: [],
        selectedScript: null,
        ev: null,
        decompiledScripts: {}, // Clear decompiled scripts when loading new scripts
        scriptHistory: [], // Clear script history when loading new scripts
        currentHistoryIndex: -1,
      }))

      const targetMap = mapId || state.selectedMap
      console.debug("[Scripts] Loading scripts for map", targetMap)

      const evData = await getFile(targetMap.toLowerCase() + ".ev")
      if (!evData) {
        console.error("Failed to read ev file")
        return undefined
      }

      console.debug("[Scripts] Parsing ev file")

      const evFile = new EvFile(evData)
      setState((prev) => ({
        ...prev,
        functions: evFile.functions,
        ev: evFile,
        loaded: true,
      }))

      console.debug("[Scripts] Scripts loaded", evFile.functions)
      return evFile.functions
    } catch (error) {
      console.error("Error loading scripts:", error)
      setMessage("Failed to load scripts: " + (error as Error).message, true)
      return undefined
    }
  }

  const setSelectedMap = (map: MapId) => {
    setState((prev) => ({ ...prev, selectedMap: map }))
  }

  const setScriptType = (type: FunctionType) => {
    setState((prev) => ({ ...prev, scriptType: type, selectedScript: null }))
  }

  const selectScript = (script: FF7Function) => {
    const selection: SelectedScript = {
      type: script.type,
      id: script.id,
      aliasId: script.aliasId,
      ...(script.type === FunctionType.Model && { modelId: script.modelId }),
      ...(script.type === FunctionType.Mesh && { x: script.x, y: script.y }),
    }

    setState((prev) => {
      // Create new history array
      let newHistory = [...prev.scriptHistory]
      let newIndex = prev.currentHistoryIndex

      // If we're not at the end of history, remove everything after current position
      if (newIndex < newHistory.length - 1) {
        newHistory = newHistory.slice(0, newIndex + 1)
      }

      // Add new selection to history
      newHistory.push(selection)
      newIndex = newHistory.length - 1

      return {
        ...prev,
        selectedScript: selection,
        scriptType: script.type,
        scriptHistory: newHistory,
        currentHistoryIndex: newIndex,
      }
    })
  }

  const isScriptSelected = (script: FF7Function): boolean => {
    if (!state.selectedScript) return false

    switch (script.type) {
      case FunctionType.System:
        return state.selectedScript.type === script.type && state.selectedScript.id === script.id
      case FunctionType.Model:
        return (
          state.selectedScript.type === script.type &&
          state.selectedScript.id === script.id &&
          state.selectedScript.modelId === script.modelId
        )
      case FunctionType.Mesh:
        return (
          state.selectedScript.type === script.type &&
          state.selectedScript.id === script.id &&
          state.selectedScript.x === script.x &&
          state.selectedScript.y === script.y
        )
    }
  }

  const isAliasSelected = (): boolean => {
    if (!state.selectedScript) return false

    const selectedScript = state.functions.find((f) => isScriptSelected(f))
    return selectedScript?.aliasId !== undefined
  }

  const getAliasTargetScript = (): FF7Function | null => {
    if (!state.selectedScript) return null

    const selectedScript = state.functions.find((f) => isScriptSelected(f))
    if (!selectedScript?.aliasId) return null

    return (
      state.functions.find(
        (f) => (f.type === FunctionType.System || f.type === FunctionType.Model) && f.id === selectedScript.aliasId
      ) || null
    )
  }

  const getSelectedScript = (): FF7Function | null => {
    if (!state.selectedScript) return null

    // First try to find the directly selected script
    let selectedScript = state.functions.find((f) => isScriptSelected(f))

    // If the selected script is an alias, find and return the target script
    if (selectedScript?.aliasId !== undefined) {
      const targetScript = state.functions.find(
        (f) => (f.type === FunctionType.System || f.type === FunctionType.Model) && f.id === selectedScript!.aliasId
      )

      if (targetScript) {
        return targetScript
      }
    }

    return selectedScript || null
  }

  const updateSelectedScript = (updates: Partial<FF7Function>) => {
    const currentScript = getSelectedScript()
    if (!currentScript) return

    console.debug("[Scripts] Updating script", currentScript.id, updates)

    // Check if we're editing an alias - if so, we need to update the target script
    const isEditingAlias = isAliasSelected()
    const targetScript = isEditingAlias ? getAliasTargetScript() : null
    const scriptToUpdate = targetScript || currentScript

    // Update the script in the functions array
    setState((prev) => {
      const updatedFunctions = prev.functions.map((fn) => {
        // If editing an alias, update the target script; otherwise update the selected script
        const shouldUpdate = isEditingAlias
          ? fn.type === scriptToUpdate.type && fn.id === scriptToUpdate.id
          : isScriptSelected(fn)

        if (!shouldUpdate) return fn

        switch (fn.type) {
          case FunctionType.System:
            return {
              ...fn,
              ...updates,
            } as SystemFunction
          case FunctionType.Model:
            return {
              ...fn,
              ...updates,
            } as ModelFunction
          case FunctionType.Mesh:
            return {
              ...fn,
              ...updates,
            } as MeshFunction
        }
      })

      return {
        ...prev,
        functions: updatedFunctions,
      }
    })

    // Also update the selection state if needed (only for non-alias updates)
    if (
      !isEditingAlias &&
      ("type" in updates || "id" in updates || "modelId" in updates || "x" in updates || "y" in updates)
    ) {
      selectScript({
        ...currentScript,
        ...updates,
      } as FF7Function)
    }
  }

  const setDecompiledMode = (enabled: boolean) => {
    setState((prev) => ({ ...prev, decompiled: enabled }))
  }

  const getScriptKey = (script: FF7Function): string => {
    switch (script.type) {
      case FunctionType.System:
        return `sys-${script.id}`
      case FunctionType.Model:
        return `mdl-${script.modelId}-${script.id}`
      case FunctionType.Mesh:
        return `mesh-${script.x}-${script.y}-${script.id}`
    }
  }

  const getDecompiledScript = (script: FF7Function): string => {
    const key = getScriptKey(script)
    return state.decompiledScripts[key] || ""
  }

  const updateDecompiledScript = (script: FF7Function, content: string) => {
    const key = getScriptKey(script)
    setState((prev) => ({
      ...prev,
      decompiledScripts: {
        ...prev.decompiledScripts,
        [key]: content,
      },
    }))
  }

  const addModelScript = async (modelId: number, functionId: number) => {
    try {
      if (!state.ev) {
        throw new Error("No scripts loaded")
      }

      const newFunction = state.ev.addModelFunction(modelId, functionId)

      // Update the functions list to match the EvFile's functions array
      setState((prev) => ({
        ...prev,
        functions: state.ev!.functions,
      }))

      // Select the new script
      selectScript(newFunction)

      setMessage(`Added new model script ${modelId}:${functionId}`)
      return newFunction
    } catch (error) {
      console.error("Error adding model script:", error)
      setMessage("Failed to add model script: " + (error as Error).message, true)
      throw error
    }
  }

  const addMeshScript = async (x: number, y: number, functionId: number) => {
    try {
      if (!state.ev) {
        throw new Error("No scripts loaded")
      }

      const newFunction = state.ev.addMeshFunction(x, y, functionId)

      // Update the functions list to match the EvFile's functions array
      setState((prev) => ({
        ...prev,
        functions: state.ev!.functions,
      }))

      // Select the new script
      selectScript(newFunction)

      setMessage(`Added new mesh script ${x},${y}:${functionId}`)
      return newFunction
    } catch (error) {
      console.error("Error adding mesh script:", error)
      setMessage("Failed to add mesh script: " + (error as Error).message, true)
      throw error
    }
  }

  const canGoBack = (): boolean => {
    return state.currentHistoryIndex > 0
  }

  const canGoForward = (): boolean => {
    return state.currentHistoryIndex < state.scriptHistory.length - 1
  }

  const goBack = () => {
    if (!canGoBack()) return

    const newIndex = state.currentHistoryIndex - 1
    const previousScript = state.scriptHistory[newIndex]

    setState((prev) => ({
      ...prev,
      selectedScript: previousScript,
      scriptType: previousScript.type,
      currentHistoryIndex: newIndex,
    }))
  }

  const goForward = () => {
    if (!canGoForward()) return

    const newIndex = state.currentHistoryIndex + 1
    const nextScript = state.scriptHistory[newIndex]

    setState((prev) => ({
      ...prev,
      selectedScript: nextScript,
      scriptType: nextScript.type,
      currentHistoryIndex: newIndex,
    }))
  }

  const saveScripts = async () => {
    if (!state.ev) {
      setMessage("No scripts loaded to save", true)
      return
    }

    try {
      console.time("[Scripts] Saving scripts")
      setMessage("Compiling and saving scripts...")

      // Create a copy of the EvFile to work with
      const evFile = state.ev

      // Process all functions and update their scripts if they have been modified
      // Use the EvFile's functions array as the source of truth
      for (let i = 0; i < evFile.functions.length; i++) {
        const func = evFile.functions[i]
        const scriptKey = getScriptKey(func)

        // Check if this function has a decompiled script that needs to be compiled
        if (state.decompiledScripts[scriptKey]) {
          const decompiledContent = state.decompiledScripts[scriptKey]

          try {
            // Compile the decompiled Lua code back to opcodes
            const worldscript = new Worldscript(func.offset)
            const compiledScript = worldscript.compile(decompiledContent)

            // Update the function's script in the EvFile
            evFile.setFunctionScript(i, compiledScript)

            console.debug(`[Scripts] Compiled script for function ${i} (${scriptKey})`)
          } catch (error) {
            console.error(`[Scripts] Failed to compile script for function ${i} (${scriptKey}):`, error)
            setMessage(`Failed to compile script for function ${i}: ${(error as Error).message}`, true)
            return
          }
        } else {
          // Find the corresponding function in state.functions to check for modifications
          const stateFunc = state.functions.find((sf) => getScriptKey(sf) === scriptKey)
          if (stateFunc && stateFunc.script !== func.script) {
            // If the script text has been directly modified, update it
            evFile.setFunctionScript(i, stateFunc.script)
            console.debug(`[Scripts] Updated script for function ${i} (${scriptKey})`)
          }
        }
      }

      // Generate the binary .ev file data
      const evData = evFile.writeFile()

      // Save the .ev file back to the LGP archive
      const filename = state.selectedMap.toLowerCase() + ".ev"
      await setFile(filename, evData)

      console.timeEnd("[Scripts] Saving scripts")
      setMessage("Scripts saved successfully!")
    } catch (error) {
      console.error("Error saving scripts:", error)
      setMessage("Failed to save scripts: " + (error as Error).message, true)
    }
  }

  return {
    functions: state.functions,
    selectedMap: state.selectedMap,
    scriptType: state.scriptType,
    selectedScript: state.selectedScript,
    ev: state.ev,
    decompiled: state.decompiled,
    loaded: state.loaded,
    loadScripts,
    saveScripts,
    addModelScript,
    addMeshScript,
    setSelectedMap,
    setScriptType,
    selectScript,
    isScriptSelected,
    getSelectedScript,
    updateSelectedScript,
    setDecompiledMode,
    getDecompiledScript,
    updateDecompiledScript,
    getScriptKey,
    isAliasSelected,
    getAliasTargetScript,
    // Navigation functions
    canGoBack,
    canGoForward,
    goBack,
    goForward,
  }
}
