import { atom, useAtom } from "jotai"
import { useStatusBar } from "./useStatusBar"
import { useLgpState } from "./useLgpState"
import { useAppState } from "./useAppState"
import { MapId } from "./useMaps"
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

interface SearchResult {
  script: FF7Function
  mapId: MapId
  matchText: string
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
  cursorTarget: { row: number; col: number } | null
  searchQuery: string
  searchResults: SearchResult[]
  isSearching: boolean
  modifiedScripts: Set<string> // Set of script keys that have been modified
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
  cursorTarget: null,
  searchQuery: "",
  searchResults: [],
  isSearching: false,
  modifiedScripts: new Set<string>(),
})

export function useScriptsState() {
  const [state, setState] = useAtom(scriptsStateAtom)
  const { setMessage } = useStatusBar()
  const { getFile, setFile } = useLgpState()
  const { markUnsavedChanges, clearUnsavedChanges } = useAppState()

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
        modifiedScripts: new Set<string>(), // Clear modified scripts tracking when loading new scripts
      }))

      const targetMap = mapId || state.selectedMap

      const evData = await getFile(targetMap.toLowerCase() + ".ev")
      if (!evData) {
        console.error("Failed to read ev file")
        return undefined
      }

      const evFile = new EvFile(evData)
      setState((prev) => ({
        ...prev,
        functions: evFile.functions,
        ev: evFile,
        loaded: true,
      }))

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

      // Also update the corresponding function in the EvFile
      if (prev.ev) {
        const updatedEvFunctions = prev.ev.functions.map((fn) => {
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

        // Create a new EvFile with the updated functions
        const updatedEv = Object.assign(Object.create(Object.getPrototypeOf(prev.ev)), prev.ev)
        updatedEv.functions = updatedEvFunctions

        return {
          ...prev,
          functions: updatedFunctions,
          ev: updatedEv
        }
      }

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
    markScriptModified(currentScript)
    markUnsavedChanges()
  }

  const setDecompiledMode = (enabled: boolean) => {
    setState((prev) => ({ ...prev, decompiled: enabled }))
  }

  const setCursorTarget = (row: number, col: number = 0) => {
    setState((prev) => ({ ...prev, cursorTarget: { row, col } }))
  }

  const clearCursorTarget = () => {
    setState((prev) => ({ ...prev, cursorTarget: null }))
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

  const markScriptModified = (script: FF7Function) => {
    const key = getScriptKey(script)
    setState((prev) => ({
      ...prev,
      modifiedScripts: new Set([...prev.modifiedScripts, key])
    }))
  }

  const isScriptModified = (script: FF7Function): boolean => {
    const key = getScriptKey(script)
    return state.modifiedScripts.has(key)
  }

  const getDecompiledScript = (script: FF7Function): string => {
    const key = getScriptKey(script)
    return state.decompiledScripts[key] || ""
  }

  const updateDecompiledScript = (script: FF7Function, content: string, isUserChange: boolean = false) => {
    const key = getScriptKey(script)
    setState((prev) => ({
      ...prev,
      decompiledScripts: {
        ...prev.decompiledScripts,
        [key]: content,
      },
    }))

    // Only mark as modified if this is a user-initiated change, not just caching decompiled content
    if (isUserChange) {
      markScriptModified(script)
      markUnsavedChanges()
    }
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
      markScriptModified(newFunction)
      markUnsavedChanges()
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
      markScriptModified(newFunction)
      markUnsavedChanges()
      
      return newFunction
    } catch (error) {
      console.error("Error adding mesh script:", error)
      setMessage("Failed to add mesh script: " + (error as Error).message, true)
      throw error
    }
  }

  const addSystemScript = async (functionId: number) => {
    try {
      if (!state.ev) {
        throw new Error("No scripts loaded")
      }

      const newFunction = state.ev.addSystemFunction(functionId)

      // Update the functions list to match the EvFile's functions array
      setState((prev) => ({
        ...prev,
        functions: state.ev!.functions,
      }))

      // Select the new script
      selectScript(newFunction)

      setMessage(`Added new system script ${functionId}`)
      markScriptModified(newFunction)
      markUnsavedChanges()
      return newFunction
    } catch (error) {
      console.error("Error adding system script:", error)
      setMessage("Failed to add system script: " + (error as Error).message, true)
      throw error
    }
  }

  const deleteScript = async (script: FF7Function) => {
    try {
      if (!state.ev) {
        throw new Error("No scripts loaded")
      }

      // Find the index of the script to delete
      const scriptIndex = state.ev.functions.findIndex(f =>
        f.type === script.type &&
        f.id === script.id &&
        (script.type === FunctionType.Model ? (f as ModelFunction).modelId === (script as ModelFunction).modelId : true) &&
        (script.type === FunctionType.Mesh ? (f as MeshFunction).x === (script as MeshFunction).x && (f as MeshFunction).y === (script as MeshFunction).y : true)
      )

      if (scriptIndex === -1) {
        throw new Error("Script not found")
      }

      // Delete from EvFile
      state.ev.deleteFunction(scriptIndex)

      // Update the functions list to match the EvFile's functions array
      setState((prev) => ({
        ...prev,
        functions: state.ev!.functions,
        selectedScript: null, // Clear selection after deletion
      }))

      setMessage(`Deleted script`)
      markUnsavedChanges()
    } catch (error) {
      console.error("Error deleting script:", error)
      setMessage("Failed to delete script: " + (error as Error).message, true)
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

  const updateScriptByReference = (scriptToUpdate: FF7Function, updates: Partial<FF7Function>) => {
    setState((prev) => {
      const updatedFunctions = prev.functions.map((fn) => {
        // Match by the same criteria as the script
        const shouldUpdate = (() => {
          switch (fn.type) {
            case FunctionType.System:
              return fn.type === scriptToUpdate.type && fn.id === scriptToUpdate.id
            case FunctionType.Model:
              return fn.type === scriptToUpdate.type && fn.id === scriptToUpdate.id && fn.modelId === (scriptToUpdate as ModelFunction).modelId
            case FunctionType.Mesh:
              return fn.type === scriptToUpdate.type && fn.id === scriptToUpdate.id && fn.x === (scriptToUpdate as MeshFunction).x && fn.y === (scriptToUpdate as MeshFunction).y
          }
        })()

        if (!shouldUpdate) return fn

        switch (fn.type) {
          case FunctionType.System:
            return { ...fn, ...updates } as SystemFunction
          case FunctionType.Model:
            return { ...fn, ...updates } as ModelFunction
          case FunctionType.Mesh:
            return { ...fn, ...updates } as MeshFunction
        }
      })

      // Also update the corresponding function in the EvFile
      if (prev.ev) {
        const updatedEvFunctions = prev.ev.functions.map((fn) => {
          // Match by the same criteria as the script
          const shouldUpdate = (() => {
            switch (fn.type) {
              case FunctionType.System:
                return fn.type === scriptToUpdate.type && fn.id === scriptToUpdate.id
              case FunctionType.Model:
                return fn.type === scriptToUpdate.type && fn.id === scriptToUpdate.id && fn.modelId === (scriptToUpdate as ModelFunction).modelId
              case FunctionType.Mesh:
                return fn.type === scriptToUpdate.type && fn.id === scriptToUpdate.id && fn.x === (scriptToUpdate as MeshFunction).x && fn.y === (scriptToUpdate as MeshFunction).y
            }
          })()

          if (!shouldUpdate) return fn

          switch (fn.type) {
            case FunctionType.System:
              return { ...fn, ...updates } as SystemFunction
            case FunctionType.Model:
              return { ...fn, ...updates } as ModelFunction
            case FunctionType.Mesh:
              return { ...fn, ...updates } as MeshFunction
          }
        })

        // Create a new EvFile with the updated functions
        const updatedEv = Object.assign(Object.create(Object.getPrototypeOf(prev.ev)), prev.ev)
        updatedEv.functions = updatedEvFunctions

        return {
          ...prev,
          functions: updatedFunctions,
          ev: updatedEv
        }
      }

      return { ...prev, functions: updatedFunctions }
    })
    markScriptModified(scriptToUpdate)
    markUnsavedChanges()
  }

  // Search functionality
  const setSearchQuery = (query: string) => {
    setState((prev) => ({ ...prev, searchQuery: query }))
  }

  const searchScripts = async (query: string): Promise<SearchResult[]> => {
    if (query.length < 3) return []

    setState((prev) => ({ ...prev, isSearching: true }))

    try {
      const results: SearchResult[] = []
      const maps: MapId[] = ['WM0', 'WM2', 'WM3']

      // Search across all maps
      for (const mapId of maps) {
        try {
          const evData = await getFile(mapId.toLowerCase() + ".ev")
          if (!evData) continue

          const evFile = new EvFile(evData)

          // Search through each function's decompiled script
          for (const func of evFile.functions) {
            const scriptKey = getScriptKey(func)
            let scriptContent = state.decompiledScripts[scriptKey]

            // If we don't have the decompiled content cached, we need to decompile it
            if (!scriptContent) {
              try {
                const worldscript = new Worldscript(func.offset)
                scriptContent = worldscript.decompile(func.script)
                // Cache the decompiled content (not a user change, just caching)
                updateDecompiledScript(func, scriptContent, false)
              } catch (error) {
                // Skip functions that can't be decompiled
                continue
              }
            }

            // Check if the query matches the decompiled content (case insensitive)
            if (scriptContent.toLowerCase().includes(query.toLowerCase())) {
              // Find the matching text snippet (up to 100 characters around the match)
              const lowerContent = scriptContent.toLowerCase()
              const lowerQuery = query.toLowerCase()
              const matchIndex = lowerContent.indexOf(lowerQuery)
              const start = Math.max(0, matchIndex - 50)
              const end = Math.min(scriptContent.length, matchIndex + query.length + 50)
              const matchText = scriptContent.substring(start, end)

              results.push({
                script: func,
                mapId,
                matchText: matchText.trim(),
              })
            }
          }
        } catch (error) {
          console.error(`Error searching map ${mapId}:`, error)
        }
      }

      setState((prev) => ({ ...prev, searchResults: results, isSearching: false }))
      return results
    } catch (error) {
      console.error("Error during search:", error)
      setState((prev) => ({ ...prev, isSearching: false }))
      return []
    }
  }

  const clearSearch = () => {
    setState((prev) => ({
      ...prev,
      searchQuery: "",
      searchResults: [],
      isSearching: false
    }))
  }

  const saveScripts = async () => {
    if (!state.ev) {
      setMessage("No scripts loaded to save", true)
      return
    }

    try {
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
          }
        }
      }

      // Generate the binary .ev file data
      const evData = evFile.writeFile()

      // Save the .ev file back to the LGP archive
      const filename = state.selectedMap.toLowerCase() + ".ev"
      await setFile(filename, evData)

      console.debug("Scripts saved successfully!")
      setState((prev) => ({ ...prev, modifiedScripts: new Set() })) // Clear modified scripts tracking
      clearUnsavedChanges()
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
    cursorTarget: state.cursorTarget,
    searchQuery: state.searchQuery,
    searchResults: state.searchResults,
    isSearching: state.isSearching,
    setSearchQuery,
    searchScripts,
    clearSearch,
    loadScripts,
    saveScripts,
    addModelScript,
    addMeshScript,
    addSystemScript,
    deleteScript,
    setSelectedMap,
    setScriptType,
    selectScript,
    isScriptSelected,
    getSelectedScript,
    updateSelectedScript,
    updateScriptByReference,
    setDecompiledMode,
    getDecompiledScript,
    updateDecompiledScript,
    getScriptKey,
    isAliasSelected,
    getAliasTargetScript,
    setCursorTarget,
    clearCursorTarget,
    canGoBack,
    canGoForward,
    goBack,
    goForward,
    isScriptModified,
  }
}
