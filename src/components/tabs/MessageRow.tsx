import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { ChangeEvent } from "react"
import { useScriptsState } from "@/hooks/useScriptState"
import { useAppState } from "@/hooks/useAppState"
import { Worldscript } from "@/ff7/worldscript/worldscript"
import { useStatusBar } from "@/hooks/useStatusBar"

interface MessageRowProps {
  index: number
  message: string
  onChange: (value: string) => void
  onRemove?: (index: number) => void
}

export function MessageRow({ index, message, onChange, onRemove }: MessageRowProps) {
  const { getDecompiledScript, loadScripts, setSelectedMap, selectScript, updateDecompiledScript, setCursorTarget } = useScriptsState()
  const { setCurrentTab } = useAppState()
  const { setMessage } = useStatusBar()

  const handleJumpToScript = async () => {
    const maps: ("WM0" | "WM2" | "WM3")[] = ["WM0", "WM2", "WM3"]

    // Search through all maps for scripts that call Window.set_message(<id>)
    for (const mapId of maps) {
      // Load scripts for this map
      const loadedFunctions = await loadScripts(mapId)
      if (!loadedFunctions) continue

      // Search through the scripts in this map
      const targetScript = loadedFunctions.find(script => {
        let decompiledContent = getDecompiledScript(script)

        // If no decompiled content exists, decompile it on-the-fly
        if (!decompiledContent) {
          // Skip scripts that don't have valid script content
          if (!script.script || typeof script.script !== 'string' || script.script.trim().length === 0) {
            return false
          }

          try {
            const worldscript = new Worldscript(script.offset, false)
            decompiledContent = worldscript.decompile(script.script, true)
            // Store it for future use (not a user change, just caching)
            updateDecompiledScript(script, decompiledContent, false)
          } catch (error) {
            return false
          }
        }

        // Look for Window.set_message(id) or Window.set_prompt(id, ...) pattern (id is first param)
        const messageOrPromptRegex = new RegExp(`Window\\.(set_message|set_prompt)\\s*\\(\\s*${index}\\s*(?:,|\\))`)
        return messageOrPromptRegex.test(decompiledContent)
      })

      if (targetScript) {
        // Determine the line number to place the cursor on
        let content = getDecompiledScript(targetScript)
        if (!content) {
          try {
            const ws = new Worldscript(targetScript.offset, false)
            content = ws.decompile(targetScript.script, true)
            updateDecompiledScript(targetScript, content, false)
          } catch (err) {
            
          }
        }
        const lines = content ? content.split('\n') : []
        let targetRow = 0
        let targetCol = 0
        if (lines.length > 0) {
          for (let i = 0; i < lines.length; i++) {
            if (new RegExp(`Window\\.(set_message|set_prompt)\\s*\\(\\s*${index}\\s*(?:,|\\))`).test(lines[i])) {
              targetRow = i
              const line = lines[i]
              const firstNonWs = line.search(/\S/)
              targetCol = firstNonWs >= 0 ? firstNonWs : 0
              break
            }
          }
        }
        // Set the selected map
        setSelectedMap(mapId)

        // Select the script
        selectScript(targetScript)
        // Set cursor after selection so editor can move caret
        setCursorTarget(targetRow, targetCol)
        // Finally switch to Scripts tab (after state above queued)
        setCurrentTab("scripts")
        return
      }
    }
    setMessage("Could not find a corresponding script for this message", true)
  }

  return (
    <div className="flex items-start gap-2 w-full">
      <div className="shrink-0 font-bold w-[85px] text-zinc-300 text-sm">
        Message {index}:
      </div>
      <div className="flex-1">
        <Textarea
          value={message}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
          className="text-sm text-zinc-300"
        />
      </div>
      <div className="flex flex-col gap-1 shrink-0">
        {index >= 20 && (
          <Button
            size="sm"
            variant="secondary"
            className="h-8 px-2 text-xs"
            onClick={handleJumpToScript}
          >
            Jump to script
          </Button>
        )}
        {index > 61 && onRemove && (
          <Button
            size="sm"
            variant="destructive"
            className="h-8 px-2 text-xs"
            onClick={() => onRemove(index)}
          >
            Remove
          </Button>
        )}
      </div>
    </div>
  )
} 