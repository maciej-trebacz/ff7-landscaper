import { atom, useAtom } from 'jotai'
import { useEffect } from 'react'
import { invoke } from "@tauri-apps/api/core";

interface AppState {
  dataPath: string | null
  opened: boolean
  openedTime: number
  connected: boolean
  loading: boolean
  loadingStep: string
  currentTab: string
  alert: {
    show: boolean
    title: string
    message: string
  }
}

const appStateAtom = atom<AppState>({
  dataPath: null,
  opened: false,
  openedTime: 0,
  connected: false,
  loading: false,
  loadingStep: '',
  currentTab: 'messages',
  alert: {
    show: false,
    title: '',
    message: ''
  }
})

export function useAppState() {
  const [state, setState] = useAtom(appStateAtom)

  const setDataPath = (path: string) => {
    setState(prev => ({
      ...prev,
      dataPath: path,
      opened: true,
      openedTime: Date.now()
    }))
  }

  const setLoading = (loading: boolean) => {
    setState(prev => ({ ...prev, loading, loadingStep: loading ? prev.loadingStep : '' }))
  }

  const setCurrentTab = (tab: string) => {
    setState(prev => ({ ...prev, currentTab: tab }))
  }

  const setLoadingStep = (step: string) => {
    setState(prev => ({ ...prev, loading: true, loadingStep: step }))
  }

  const showAlert = (title: string, message: string) => {
    setState(prev => ({
      ...prev,
      alert: {
        show: true,
        title,
        message
      }
    }))
  }

  const hideAlert = () => {
    setState(prev => ({
      ...prev,
      alert: {
        show: false,
        title: '',
        message: ''
      }
    }))
  }

  const checkConnection = async () => {
    try {
      const isRunning = await invoke<boolean>('is_ff7_running')
      setState(prev => ({ ...prev, connected: isRunning }))
    } catch (error) {
      console.error('Failed to check FF7 connection:', error)
      setState(prev => ({ ...prev, connected: false }))
    }
  }

  useEffect(() => {
    // Check connection immediately
    checkConnection()

    // Then check every 2 seconds
    const interval = setInterval(checkConnection, 2000)

    return () => clearInterval(interval)
  }, [])

  return {
    ...state,
    setDataPath,
    setLoading,
    setLoadingStep,
    setCurrentTab,
    showAlert,
    hideAlert
  }
}