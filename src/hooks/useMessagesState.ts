import { atom, useAtom } from 'jotai'
import { debounce } from 'lodash-es'
import React from 'react'
import { useStatusBar } from './useStatusBar'
import { invoke } from "@tauri-apps/api/core"
import { MesFile } from "@/ff7/mesfile"
import { useLgpState } from './useLgpState'

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
      console.debug("[Messages] Saving messages")
      const mesData = await getFile("mes")
      if (!mesData) {
        throw new Error("Failed to read mes file")
      }

      const mesFile = new MesFile(mesData)
      state.messages.forEach((text, index) => {
        mesFile.setMessage(index, text)
      })

      const newData = mesFile.writeMessages()
      await setFile("mes", newData)
      setMessage("Messages saved successfully")
    } catch (error) {
      console.error("[Messages] Failed to save messages:", error)
      setMessage("Failed to save messages: " + (error as Error).message, true)
    }
  }

  const updateMessage = (index: number, value: string) => {
    setState(prev => {
      const newMessages = prev.messages.map((msg, i) => i === index ? value : msg)
      debouncedSync(newMessages)
      return {
        ...prev,
        messages: newMessages
      }
    })
  }

  const syncMessages = async (messages: string[]) => {
    const mesFile = new MesFile()
    mesFile.setMessages(messages)
    const data = mesFile.writeMessages()
    await invoke("update_mes_data", { data })
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
    updateMessage
  }
}