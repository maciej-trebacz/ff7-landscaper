"use strict";

import { atom, useAtom } from 'jotai'
import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { BattleScene } from "./types";
import { useAppState } from './useAppState'

interface BattleDataState {
  battleScenes: BattleScene[]
  isLoading: boolean
  error: string | null
  loaded: boolean
  currentDataPath: string | null
}

const battleDataStateAtom = atom<BattleDataState>({
  battleScenes: [],
  isLoading: false,
  error: null,
  loaded: false,
  currentDataPath: null,
})

export function useBattleData() {
  const [state, setState] = useAtom(battleDataStateAtom)
  const { dataPath } = useAppState()

  const loadBattleScenes = async (path: string) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }))
      const scenes: BattleScene[] = await invoke("read_battle_scenes", { gameDirectory: path })
      setState(prev => ({
        ...prev,
        battleScenes: scenes,
        isLoading: false,
        loaded: true,
        currentDataPath: path,
        error: null
      }))
    } catch (err) {
      console.error("Failed to load battle scenes:", err)
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : String(err),
        loaded: false
      }))
    }
  }

  useEffect(() => {
    if (!dataPath) {
      // Reset state if no dataPath
      setState(prev => ({
        ...prev,
        battleScenes: [],
        loaded: false,
        currentDataPath: null,
        error: null
      }))
      return
    }

    // Only load if dataPath changed or we haven't loaded for this path
    if (dataPath !== state.currentDataPath || !state.loaded) {
      loadBattleScenes(dataPath)
    }
  }, [dataPath, state.currentDataPath, state.loaded])

  const refetch = () => {
    if (dataPath) {
      loadBattleScenes(dataPath)
    }
  }

  return {
    battleScenes: state.battleScenes,
    isLoading: state.isLoading,
    error: state.error,
    loaded: state.loaded,
    refetch
  }
}

