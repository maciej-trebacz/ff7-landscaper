import { atom, useAtom } from 'jotai'
import { debounce } from 'lodash-es'
import React from 'react'
import { useStatusBar } from './useStatusBar'
import { invoke } from "@tauri-apps/api/core"
import { MesFile } from "@/ff7/mesfile"
import { useLgpState } from './useLgpState'
import { useAppState } from './useAppState'

interface MessagesState {
  messages: string[]
  loaded: boolean
}

const messagesStateAtom = atom<MessagesState>({
  messages: [],
  loaded: false
})

export function useMessagesState() {
  const [state, setState] = useAtom(messagesStateAtom)
  const { setMessage } = useStatusBar()
  const { getFile, setFile } = useLgpState()
  const { markUnsavedChanges, clearUnsavedChanges } = useAppState()
  const timeoutRef = React.useRef<number>()

  const debouncedSync = React.useMemo(
    () => debounce(async (messages: string[]) => {
      try {
        await syncMessages(messages)
      } catch (error) {
        setMessage(error as string, true)
        return
      }

      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current)
      }
      setMessage('Messages synced with the game')
      timeoutRef.current = window.setTimeout(() => {
        setMessage('')
      }, 2000)
    }, 500),
    []
  )

  const loadMessages = async () => {
    try {
      console.debug("[Messages] Loading messages")
      const mesData = await getFile("mes")
      if (!mesData) {
        console.error("Failed to read mes file")
        return
      }

      const mesFile = new MesFile(mesData)
      setState(prev => ({
        ...prev,
        messages: mesFile.data.messages.map(msg => msg.text),
        loaded: true
      }))
    } catch (error) {
      console.error("Error loading messages:", error)
      setMessage("Failed to load messages: " + (error as Error).message, true)
    }
  }

  const saveMessages = async () => {
    try {
      setMessage('Saving messages...')

      const mesFile = new MesFile()
      mesFile.setMessages(state.messages)
      const newData = mesFile.writeMessages()
      await setFile("mes", newData)
      console.debug("Messages saved successfully")
      clearUnsavedChanges()
    } catch (error) {
      console.error("[Messages] Failed to save messages:", error)
      throw error
    }
  }

  const updateMessage = (index: number, value: string) => {
    if (state.messages[index] === value) {
      return
    }

    setState(prev => {
      const newMessages = prev.messages.map((msg, i) => i === index ? value : msg)
      debouncedSync(newMessages)
      return {
        ...prev,
        messages: newMessages
      }
    })
    markUnsavedChanges()
  }

  const syncMessages = async (messages: string[]) => {
    const mesFile = new MesFile()
    mesFile.setMessages(messages)
    const data = mesFile.writeMessages()
    await invoke("update_mes_data", { data })
  }

  const addMessage = (message: string = "") => {
    setState(prev => {
      const newMessages = [...prev.messages, message]
      debouncedSync(newMessages)
      return {
        ...prev,
        messages: newMessages
      }
    })
    markUnsavedChanges()
  }

  const removeMessage = (index: number) => {
    if (index < 0 || index >= state.messages.length) {
      return
    }

    setState(prev => {
      const newMessages = prev.messages.filter((_, i) => i !== index)
      debouncedSync(newMessages)
      return {
        ...prev,
        messages: newMessages
      }
    })
    markUnsavedChanges()
  }

  React.useEffect(() => {
    return () => {
      debouncedSync.cancel()
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current)
      }
    }
  }, [debouncedSync])

  return {
    messages: state.messages,
    loaded: state.loaded,
    loadMessages,
    saveMessages,
    updateMessage,
    addMessage,
    removeMessage
  }
}