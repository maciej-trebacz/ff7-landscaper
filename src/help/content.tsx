import { useMemo, useState } from "react"
import {
  HelpCallout,
} from "./components"
import type { HelpTabDefinition } from "./types"
import {
  Globe2,
  Images,
  MapPinned,
  MessageSquare,
  Swords,
  FileCode,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"
import { Namespace, Opcodes } from "@/ff7/worldscript/opcodes"

const namespaceOrder: Namespace[] = [
  Namespace.System,
  Namespace.Player,
  Namespace.Entity,
  Namespace.Point,
  Namespace.Camera,
  Namespace.Sound,
  Namespace.Savemap,
  Namespace.Special,
  Namespace.Temp,
  Namespace.Window,
  Namespace.Memory,
  Namespace.Math,
]

const namespaceDescriptions: Record<Namespace, string> = {
  [Namespace.System]: "World map engine flow control, environment toggles, and vehicle state management.",
  [Namespace.Player]: "Player avatar state, party composition, and interaction handling.",
  [Namespace.Entity]: "Operations performed on the currently bound world entity or models.",
  [Namespace.Point]: "Vector math helpers for points and direction calculations.",
  [Namespace.Camera]: "Camera placement, motion, and cinematic helpers.",
  [Namespace.Sound]: "Music, SFX, and ambient audio triggers.",
  [Namespace.Savemap]: "Persistent savemap values and flag manipulation.",
  [Namespace.Special]: "Event flags mirrored from the field scripts.",
  [Namespace.Temp]: "Short-lived temporary variables local to the world map engine.",
  [Namespace.Window]: "UI windows, prompts, and message boxes.",
  [Namespace.Memory]: "Direct memory slots (rarely used).",
  [Namespace.Math]: "Arithmetic and logical primitives used across scripts.",
}

function formatHex(value: number) {
  return `0x${value.toString(16).toUpperCase().padStart(3, "0")}`
}



function OpcodesByNamespace() {
  const [query, setQuery] = useState("")

  const grouped = useMemo(() => {
    const entries = Object.entries(Opcodes)
      .map(([key, def]) => ({
        id: Number(key),
        ...def,
      }))
      // Filter out opcodes that don't have decompiled equivalents
      .filter(entry => {
        const hiddenOpcodes = [
          0x100, // reset_stack
          0x201, // goto_if_false
          0x204, // call_fn_
          0x305, // wait_frames
          0x306, // wait
          0x334, // wait_for_function
        ]
        return !hiddenOpcodes.includes(entry.id)
      })

    const filtered = !query
      ? entries
      : entries.filter((entry) => {
          const haystack = [
            entry.mnemonic,
            entry.name,
            entry.description,
            ...(entry.notes ? [entry.notes] : []),
          ]
            .join(" ")
            .toLowerCase()
          return haystack.includes(query.toLowerCase())
        })

    const namespaces = new Map<Namespace, typeof filtered>()
    filtered.forEach((entry) => {
      const bucket = namespaces.get(entry.namespace)
      if (!bucket) {
        namespaces.set(entry.namespace, [entry])
      } else {
        bucket.push(entry)
      }
    })

    namespaceOrder.forEach((ns) => {
      if (!namespaces.has(ns)) {
        namespaces.set(ns, [])
      }
    })

    return Array.from(namespaces.entries()).map(([namespace, list]) => ({
      namespace,
      list: list.sort((a, b) => a.id - b.id),
    }))
  }, [query])


  // Check if opcode is a control flow keyword
  const isControlFlowKeyword = (opcode: number) => {
    const keywordOpcodes = [
      0x200, // goto
      0x203, // return
    ]
    return keywordOpcodes.includes(opcode)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Search across all namespaces. Results stay grouped so you can compare related calls side by side.
          </p>
        </div>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter opcodes by mnemonic, name, or description"
          className="h-9 w-full sm:w-[320px] max-[700px]:text-xs"
        />
      </div>

      <div className="space-y-2">
        {grouped.map(({ namespace, list }) => (
          <Collapsible key={namespace} defaultOpen className="border border-zinc-800/80 rounded-lg bg-zinc-900/40">
            <div className="flex items-center justify-between px-3 py-2">
              <div>
                <div className="text-sm font-semibold text-zinc-100">{namespace}</div>
                <p className="text-xs text-muted-foreground">{namespaceDescriptions[namespace]}</p>
              </div>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="text-xs">
                  {list.length ? `${list.length} opcodes` : "Empty"}
                </Button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent>
              {list.length === 0 ? (
                <div className="px-3 pb-3 text-xs text-muted-foreground max-[700px]:text-[10px] max-[700px]:px-2 max-[700px]:pb-2">No opcodes match this filter.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-zinc-900/60">
                        <TableHead className="w-24 text-xs uppercase tracking-wide max-[700px]:text-[10px] max-[700px]:px-2 max-[700px]:py-1">Opcode</TableHead>
                        <TableHead className="w-32 text-xs uppercase tracking-wide max-[700px]:text-[10px] max-[700px]:px-2 max-[700px]:py-1">Mnemonic</TableHead>
                        <TableHead className="w-36 text-xs uppercase tracking-wide max-[700px]:text-[10px] max-[700px]:px-2 max-[700px]:py-1">
                          {namespace === Namespace.Math ? 'Operator' : 'Name'}
                        </TableHead>
                        <TableHead className="text-xs uppercase tracking-wide max-[700px]:text-[10px] max-[700px]:px-2 max-[700px]:py-1">Description</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {list.map((entry) => (
                        <TableRow key={entry.id} className="border-zinc-800/60">
                          <TableCell className="font-mono text-xs text-zinc-300 max-[700px]:text-[10px] max-[700px]:px-2 max-[700px]:py-1">{formatHex(entry.id)}</TableCell>
                          <TableCell className="font-mono text-xs text-sky-300 max-[700px]:text-[10px] max-[700px]:px-2 max-[700px]:py-1">{entry.mnemonic}</TableCell>
                          <TableCell className="text-sm text-zinc-100 max-[700px]:text-xs max-[700px]:px-2 max-[700px]:py-1">
                            <div className="flex items-center gap-2">
                              {namespace === Namespace.Math ? (
                                <span className="font-mono font-bold">{entry.operator}</span>
                              ) : (
                                entry.name
                              )}
                              {isControlFlowKeyword(entry.id) && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-900/30 text-blue-300 border border-blue-700/50">
                                  keyword
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-zinc-200 leading-relaxed max-[700px]:text-xs max-[700px]:px-2 max-[700px]:py-1">
                            {entry.description}
                            {entry.notes && (
                              <span className="block text-xs text-muted-foreground mt-1 max-[700px]:text-[10px]">{entry.notes}</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    </div>
  )
}

function MapWorkspaceOverview() {
  return (
    <div className="border border-zinc-700 rounded-lg bg-zinc-900/50 p-4 max-[700px]:p-2">
      {/* App window representation */}
      <div className="bg-zinc-800 rounded border border-zinc-600 overflow-hidden">
        {/* Controls bar */}
        <div className="bg-zinc-700 px-3 py-2 border-b border-zinc-600 max-[700px]:px-2 max-[700px]:py-1">
          <div className="px-3 py-2 space-y-1 text-sm max-[700px]:px-2 max-[700px]:py-1 max-[700px]:text-xs max-[700px]:space-y-0.5">
            <div className="text-xs uppercase tracking-wide font-semibold opacity-80 text-zinc-300 max-[700px]:text-[10px]">Controls bar</div>
            <div className="leading-relaxed text-zinc-200 max-[700px]:text-xs">Mode buttons for selection, painting, and export. Map type selector, rendering mode dropdown, display toggles, alternatives popover, and camera controls.</div>
          </div>
        </div>

        {/* Main content area */}
        <div className="flex min-h-[300px] max-[700px]:min-h-[200px]">
          {/* Map viewport */}
          <div className="flex-1 bg-zinc-900">
            <div className="p-3 h-full max-[700px]:p-2">
              <div className="px-3 py-2 space-y-1 text-sm max-[700px]:px-2 max-[700px]:py-1 max-[700px]:text-xs max-[700px]:space-y-0.5">
                <div className="text-xs uppercase tracking-wide font-semibold opacity-80 text-zinc-300 max-[700px]:text-[10px]">Map viewport</div>
                <div className="leading-relaxed text-zinc-200 max-[700px]:text-xs">Interactive 3D world map with orbit controls. Click triangles to inspect data, paint terrain, or export sections.</div>
                <div className="leading-relaxed text-zinc-200 max-[700px]:text-xs">
                  <ul className="space-y-1 mt-2">
                    <li className="flex items-center gap-2">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-zinc-800 text-zinc-200 border border-zinc-600">Left mouse button</span>
                      <span className="text-zinc-400">→</span>
                      <span>Orbit around</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-zinc-800 text-zinc-200 border border-zinc-600">Right mouse button</span>
                      <span className="text-zinc-400">→</span>
                      <span>Pan around</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-zinc-800 text-zinc-200 border border-zinc-600">Scroll wheel</span>
                      <span className="text-zinc-400">or</span>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-zinc-800 text-zinc-200 border border-zinc-600">Middle mouse button</span>
                      <span className="text-zinc-400">→</span>
                      <span>Zoom in/out</span>
                    </li>
                  </ul>
                  <p className="mt-2 text-zinc-200 max-[700px]:text-xs">Click the <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-zinc-800 text-zinc-200 border border-zinc-600">Home</span> button to reset the view to the initial camera view.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Context sidebar */}
          <div className="w-[240px] border-l border-zinc-600 bg-zinc-850 flex-shrink-0 max-[700px]:w-[140px]">
            <div className="p-3 max-[700px]:p-2">
              <div className="px-3 py-2 space-y-1 text-sm max-[700px]:px-2 max-[700px]:py-1 max-[700px]:text-xs max-[700px]:space-y-0.5">
                <div className="text-xs uppercase tracking-wide font-semibold opacity-80 text-zinc-300 max-[700px]:text-[10px]">Context sidebar</div>
                <div className="leading-relaxed text-zinc-200 max-[700px]:text-xs">Mode-specific tools and data. Shows triangle info, paint palettes, or export options depending on the active mode.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ScriptWorkspaceOverview() {
  return (
    <div className="border border-zinc-700 rounded-lg bg-zinc-900/50 p-4 max-[700px]:p-2">
      {/* App window representation */}
      <div className="bg-zinc-800 rounded border border-zinc-600 overflow-hidden">
        {/* Control bar */}
        <div className="bg-zinc-700 px-3 py-2 border-b border-zinc-600 max-[700px]:px-2 max-[700px]:py-1">
          <div className="px-3 py-2 space-y-1 text-sm max-[700px]:px-2 max-[700px]:py-1 max-[700px]:text-xs max-[700px]:space-y-0.5">
            <div className="text-xs uppercase tracking-wide font-semibold opacity-80 text-zinc-300 max-[700px]:text-[10px]">Control bar</div>
            <div className="leading-relaxed text-zinc-200 max-[700px]:text-xs">Switch maps, filter by script type, add new scripts, or undo/redo navigation jumps. The search box lets you search for any text inside all scripts. Results show up in the script list.</div>
          </div>
        </div>

        {/* Main content area */}
        <div className="flex min-h-[300px] max-[700px]:min-h-[200px]">
          {/* Script list sidebar */}
          <div className="w-[180px] border-r border-zinc-600 bg-zinc-850 flex-shrink-0 max-[700px]:w-[120px]">
            <div className="p-3 max-[700px]:p-2">
              <div className="px-3 py-2 space-y-1 text-sm max-[700px]:px-2 max-[700px]:py-1 max-[700px]:text-xs max-[700px]:space-y-0.5">
                <div className="text-xs uppercase tracking-wide font-semibold opacity-80 text-zinc-300 max-[700px]:text-[10px]">Script list</div>
                <div className="leading-relaxed text-zinc-200 max-[700px]:text-xs">Lists the functions for the current map and type. Modified scripts are shown in yellow.</div>
              </div>
            </div>
          </div>

          {/* Editor area */}
          <div className="flex-1 bg-zinc-900">
            <div className="p-3 h-full max-[700px]:p-2">
              <div className="px-3 py-2 space-y-1 text-sm max-[700px]:px-2 max-[700px]:py-1 max-[700px]:text-xs max-[700px]:space-y-0.5">
                <div className="text-xs uppercase tracking-wide font-semibold opacity-80 text-zinc-300 max-[700px]:text-[10px]">Worldscript editor</div>
                <div className="leading-relaxed text-zinc-200 max-[700px]:text-xs">Syntax highlighted editor with inline autocomplete (press Ctrl+Space to trigger). Use the sidebar to view function documentations and tweak its parameters.</div>
              </div>
            </div>
          </div>

          {/* Context sidebar */}
          <div className="w-[240px] border-l border-zinc-600 bg-zinc-850 flex-shrink-0 max-[700px]:w-[140px]">
            <div className="p-3 max-[700px]:p-2">
              <div className="px-3 py-2 space-y-1 text-sm max-[700px]:px-2 max-[700px]:py-1 max-[700px]:text-xs max-[700px]:space-y-0.5">
                <div className="text-xs uppercase tracking-wide font-semibold opacity-80 text-zinc-300 max-[700px]:text-[10px]">Context sidebar</div>
                <div className="leading-relaxed text-zinc-200 max-[700px]:text-xs">Displays selected function parameters and documentation.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MessagesTips() {
  return (
    <HelpCallout title="Linking messages to scripts">
      Messages with an index of 20 or higher expose a <strong>Jump to script</strong> button. Landscaper will locate the first
      <span className="font-mono"> Window.set_message()</span> or <span className="font-mono">Window.set_prompt()</span> call that uses the ID,
      switch to the Scripts tab, and position the caret over the opcode.
    </HelpCallout>
  )
}


export const HELP_TABS: HelpTabDefinition[] = [
  {
    id: "messages",
    label: "Messages",
    icon: MessageSquare,
    summary:
      "View and edit every world map message string. Add new entries, prune unused lines, or jump straight to the script that calls a message.",
    sections: [
      {
        id: "messages-overview",
        title: "Message catalogue",
        paragraphs: [
          "Messages 0 through 19 are region names used for world map area identification. Message IDs 20 through 61 are dialogues and tutorial messages used by the world map.",
          "Core messages (IDs 0-61) are locked in place because they are referenced from multiple parts of the world map code. Extra messages past that range can be removed if you need to slim the table down.",
        ],
        items: [
          { label: "Editing", detail: "Type directly into the message field. Changing the message contents will not resize the message box itself - use the \"Jump to Script\" option to adjust the window dimensions in the script section." },
          { label: "Control codes", detail: "Message text supports the same control codes as the original game." },
          { label: "Size limit", detail: "The total length of all messages cannot exceed 4KB. The app will warn you if you exceed that limit." },
        ],
      },
      {
        id: "messages-jump",
        title: "Script cross references",
        component: MessagesTips,
      },
    ],
  },
  {
    id: "map",
    label: "Map",
    icon: Globe2,
    summary:
      "Inspect and edit the full 3D world map in four modes: textured, terrain, regions and scripts. Import & export map sections.",
    sections: [
      {
        id: "map-layout",
        title: "Workspace overview",
        component: MapWorkspaceOverview,
      },
      {
        id: "map-modes",
        title: "Editor modes",
        paragraphs: [
          "The map editor has three distinct modes, each with its own purpose and toolset. Switch between modes using the buttons in the controls bar.",
        ],
        items: [
          { 
            label: "Selection mode", 
            detail: "Click triangles to inspect UVs, vertices, and connected textures. Make changes in the sidebar and they will be reflected in real-time in the map view." 
          },
          { 
            label: "Painting mode", 
            detail: "Paint over triangles to select multiple triangles, then use the sidebar to bulk apply parameters like Terrain Type, Script ID, Texture, and more." 
          },
          { 
            label: "Export/Import mode", 
            detail: "Export individual meshes to .obj files, edit them in external tools, and import them back. Use the checkbox to reset normals when importing, which recalculates normals using the geometry itself to match what the game expects." 
          },
        ],
      },
      {
        id: "map-display-modes",
        title: "Display modes",
        paragraphs: [
          "The display mode dropdown changes how the world map is rendered, each emphasizing different aspects of the data.",
        ],
        items: [
          { 
            label: "Terrain type", 
            detail: "Shows the color-coded type of terrain for each triangle that influences walkability and other behavior, and also affects random encounters." 
          },
          { 
            label: "Textured", 
            detail: "Displays the world map with its original textures applied, showing how it appears in-game." 
          },
          { 
            label: "Regions", 
            detail: "Color-codes triangles by their region assignments, useful for understanding encounter zones and area boundaries." 
          },
          { 
            label: "Scripts", 
            detail: "Highlights triangles by their associated script IDs, helping visualize which areas are controlled by specific world scripts. Triangles where Chocobo encounters are possible are marked with yellow color." 
          },
        ],
      },
      {
        id: "map-display",
        title: "Display elements",
        paragraphs: [
          "You can enable various display aids to help visualize and debug the world map.",
        ],
        items: [
          { 
            label: "Wireframe", 
            detail: "Toggle wireframe overlay to see triangle edges and topology structure." 
          },
          { 
            label: "Mesh grid", 
            detail: "Show mesh boundaries over the whole world map." 
          },
          { 
            label: "Models", 
            detail: "Enable the display of the position of in-game models. This requires Final Fantasy VII to be open and connected to Landscaper. (This should happen automatically when you open the game.)" 
          },
          { 
            label: "Normals", 
            detail: "Display surface normal vectors to debug shading and lighting." 
          },
        ],
      },
      {
        id: "map-alternatives",
        title: "Alternative sections",
        paragraphs: [
          "The alternatives popover lets you toggle different section groups that depend on the world map progression (for example, the Temple of the Ancients collapse or Junon crater). This only works for the overworld map.",
        ],
      },
    ],
  },
  {
    id: "textures",
    label: "Textures",
    icon: Images,
    summary:
      "Browse and inspect texture bitmaps used on the world map",
    sections: [
      {
        id: "textures-overview",
        title: "Texture browser",
        paragraphs: [
          "Shows all textures used on the world map. Use the picker in the header to switch between Overworld, Underwater, and Great Glacier atlases.",
        ],
        items: [
          { label: "Metadata", detail: "Each card lists the internal texture id, UV offset, and native resolution." },
        ],
      },
    ],
  },
  {
    id: "locations",
    label: "Locations",
    icon: MapPinned,
    summary:
      "Manage field transition points along with their destination coordinates",
    sections: [
      {
        id: "locations-grid",
        title: "Field Destinations",
        paragraphs: [
          "Each row represents one entry in the world to field destination mapping. Each entry has a default and an optional alternative target. Alternatives are optional.",
        ],
        items: [
          { label: "Script engine interaction", detail: "These are the only valid field targets that you can jump to from the World Map script engine." },
        ],
      },
    ],
  },
  {
    id: "encounters",
    label: "Encounters",
    icon: Swords,
    summary:
      "Configure random encounter tables for each world region and terrain type. Edit Yuffie recruitment encounters and Chocobo capture ratings.",
    sections: [
      {
        id: "encounters-overview",
        title: "Encounter system overview",
        paragraphs: [
          "The world map encounter system uses region-based tables with terrain-specific encounter sets. Each region can have up to four encounter sets mapped to different terrain types like Grass, Forest, Desert, and others.",
          "Random battles are triggered based on your current region and the terrain type of the triangle you're walking on. The game first checks for special encounters (Yuffie, Chocobo) before selecting from normal random battles.",
        ],
        items: [
          { label: "Region limitation", detail: "Only the first 16 regions have unique encounter data. Regions 16 and beyond use the encounter tables from region 15." },
          { label: "Terrain mapping", detail: "Use the \"Edit Region Sets\" button to configure which terrain types map to each encounter set for a region. This data is saved in the ff7_en.exe file." },
          { label: "Encounter types", detail: "Each set includes normal encounters, back attacks, side attacks, pincer attacks, and Chocobo encounters with individual rates." },
        ],
      },
      {
        id: "encounters-regions",
        title: "Region encounter editing",
        paragraphs: [
          "Select a region from the sidebar to edit its encounter tables. Each region has four encounter sets that correspond to different terrain types.",
        ],
        items: [
          { label: "Active toggle", detail: "Enable or disable encounters for the selected set." },
          { label: "Encounter rate", detail: "Controls how frequently random battles occur on this terrain type. Higher values mean more frequent encounters. " },
          { label: "Battle selection", detail: "Each encounter entry has a battle ID and encounter rate. Use the battle picker to search and select specific battles. The maximum encounter rate is 64, and for normal encounters, all the rates should sum up to 64. Encounter rate set to 0 disables an encounter record." },
        ],
      },
      {
        id: "encounters-yuffie",
        title: "Yuffie encounters",
        paragraphs: [
          "Yuffie encounters are special battles that occur when walking on Forest or Jungle terrain in specific regions. The battle selected depends on Cloud's current level.",
        ],
        items: [
          { label: "Region chances", detail: "Each region has a specific chance percentage for Yuffie encounters, ranging from 12.5% to 99.6%. This data is hardcoded in the game's exe file." },
        ],
      },
      {
        id: "encounters-chocobo",
        title: "Chocobo encounters",
        paragraphs: [
          "Chocobo encounters occur when walking on triangles with the \"chocobo tracks\" flag set. The captured Chocobo's rating depends on the specific battle that occurred.",
        ],
      },
    ],
  },
  {
    id: "scripts",
    label: "Scripts",
    icon: FileCode,
    summary:
      "Edit, add & remove world map scripts with built-in code editor for all three script types: system, model & mesh.",
    sections: [
      {
        id: "scripts-workspace",
        title: "Workspace overview",
        component: ScriptWorkspaceOverview,
      },
      {
        id: "scripts-opcodes",
        title: "Opcode reference",
        component: OpcodesByNamespace,
      },
    ],
  },
]
