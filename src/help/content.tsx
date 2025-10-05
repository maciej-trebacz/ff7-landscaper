import { useMemo, useState } from "react"
import {
  HelpCallout,
  HelpDefinitionList,
  HelpMediaCard,
  HelpParagraph,
  Keycap,
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
import mapSelectionIllustration from "@/assets/help/map-selection.svg"
import mapPaintingIllustration from "@/assets/help/map-painting.svg"
import mapExportIllustration from "@/assets/help/map-export.svg"
import mapWireframeIllustration from "@/assets/help/map-wireframe.svg"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

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

function MapModeGallery() {
  const cards = [
    {
      image: mapSelectionIllustration,
      label: "Selection mode",
      description: "Select a triangle to inspect UVs, vertices, and connected textures. The sidebar updates live as you drag vertices.",
    },
    {
      image: mapPaintingIllustration,
      label: "Painting mode",
      description: "Brush terrain data onto the mesh. Pick a palette in the Painting sidebar to recolor or restore geography.",
    },
    {
      image: mapExportIllustration,
      label: "Export mode",
      description: "Switch to the orthographic workspace for clean captures. Export individual meshes or import edited geometry blocks.",
    },
    {
      image: mapWireframeIllustration,
      label: "Visualization toggles",
      description: "Wireframe, grid, normals, and textured overlays help you audit topology before committing edits.",
    },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {cards.map((card) => (
        <HelpMediaCard key={card.label} {...card} />
      ))}
    </div>
  )
}

function MapNavigationShortcuts() {
  return (
    <HelpDefinitionList
      items={[
        {
          label: "Rotate view",
          detail: (
            <span>
              Use <Keycap>Right click</Keycap> + drag to orbit, or the rotate buttons for 45-degree snaps.
            </span>
          ),
        },
        {
          label: "Pan",
          detail: (
            <span>
              Hold <Keycap>Shift</Keycap> while dragging or press the middle mouse button.
            </span>
          ),
        },
        {
          label: "Zoom",
          detail: (
            <span>
              Scroll to zoom in perspective mode. Export mode switches to an orthographic camera; use the slider to change scale.
            </span>
          ),
        },
        {
          label: "Reset camera",
          detail: (
            <span>
              Click the <Keycap>Home</Keycap> button in the toolbar to recenter on the active map.
            </span>
          ),
        },
      ]}
    />
  )
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

function EncountersViewTabs() {
  return (
    <Tabs defaultValue="regions" className="space-y-3">
      <TabsList className="w-fit">
        <TabsTrigger value="regions">Regions</TabsTrigger>
        <TabsTrigger value="yuffie">Yuffie</TabsTrigger>
        <TabsTrigger value="chocobo">Chocobos</TabsTrigger>
      </TabsList>
      <TabsContent value="regions" className="space-y-2">
        <HelpParagraph>
          Pick one of the 16 regional encounter tables from the left-hand list. Each region exposes multiple encounter sets
          and sliders for probability, battle formations, and formation weights.
        </HelpParagraph>
      </TabsContent>
      <TabsContent value="yuffie" className="space-y-2">
        <HelpParagraph>
          Tune the Wutai-only encounters that gate Yuffie&apos;s recruitment. Ratings map directly to the in-game encounter wheel.
        </HelpParagraph>
      </TabsContent>
      <TabsContent value="chocobo" className="space-y-2">
        <HelpParagraph>
          Adjust capture chances for each region and the minimum/maximum quality brackets the game rolls when spawning a
          chocobo.
        </HelpParagraph>
      </TabsContent>
    </Tabs>
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
          "The world map message table is loaded directly from the LGP archives. Landscaper lists entries in numeric order so they stay aligned with script references.",
          "Core messages (IDs 0-61) are locked in place because they are referenced from multiple parts of the world map code. Extra messages past that range can be removed if you need to slim the table down.",
        ],
        items: [
          { label: "Editing", detail: "Type directly into the message field. Changes mark the project as having unsaved edits." },
          { label: "Adding lines", detail: "Use the Add Message button at the bottom to append a blank entry." },
          { label: "Control codes", detail: "Message text supports the same control codes as the original game. Keep escape sequences on their own to avoid layout glitches." },
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
        title: "Editor layout",
        paragraphs: [
          "The viewport fills most of the screen and reflects the current map type. A context-sensitive sidebar on the right exposes either triangle data, paint tools, or export options depending on the active mode.",
        ],
        items: [
          { label: "Status overlay", detail: "When data is loading the viewport is locked and a progress overlay appears." },
          { label: "Model overlay", detail: "Toggle world models to preview vehicles and props while editing terrain." },
          { label: "Section selection", detail: "Clicking a triangle in selection mode updates the sidebar with exact vertex positions and UV assignments." },
        ],
      },
      {
        id: "map-modes",
        title: "Modes and toolbars",
        description: "Switch modes from the toolbar on the top left. Each mode enables a dedicated sidebar.",
        component: MapModeGallery,
      },
      {
        id: "map-navigation",
        title: "Camera and navigation",
        paragraphs: [
          "Landscaper uses orbit controls in selection and painting modes. Export mode locks rotation for consistent captures but still allows zoom and pan.",
        ],
        component: MapNavigationShortcuts,
      },
      {
        id: "map-visuals",
        title: "Visual aids",
        paragraphs: [
          "Rendering presets help you audit topology. Terrain view emphasizes height data, textured view surfaces the baked textures, and script overlay colors triangles by attached scripts.",
          "Normals and grid overlays help you debug shading artifacts. When you enable wireframe Landscaper fades edges based on camera height so dense areas stay legible.",
        ],
      },
      {
        id: "map-alternatives",
        title: "Alternative sections",
        paragraphs: [
          "The Alternatives popover toggles post-event variants such as the Temple collapse or the Junon canon crater. Landscaper keeps these toggles per session so you can quickly compare states.",
        ],
        items: [
          {
            label: "Group badges",
            detail: "The badge on the Alternatives button shows how many variant sets are enabled. Expand the popover to toggle specific section IDs.",
          },
          {
            label: "Texture sync",
            detail: "When you change alternatives the viewer automatically reloads textures for the active map type to prevent mismatches.",
          },
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
          "Textures load on demand for the selected map type. Use the picker in the header to switch between Overworld, Underwater, and Great Glacier atlases.",
        ],
        items: [
          { label: "Preview scale", detail: "Previews double the original pixel dimensions and force nearest-neighbour scaling so you can inspect seams." },
          { label: "Metadata", detail: "Each card lists the internal texture id, UV offset, and native resolution." },
          { label: "Streaming", detail: "Landscaper caches previously loaded atlases. Switching back to a map type is instant after the first load." },
        ],
      },
      {
        id: "textures-usage",
        title: "Integrating with the map editor",
        paragraphs: [
          "Use the UV offsets when lining up textures during triangle editing. Painting mode references the same atlas so changes in the texture tab are immediately reflected in the map viewer.",
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
        title: "Spawn grid",
        paragraphs: [
          "Each row represents one entry in the world map entrance table. Default coordinates populate the left half of the grid, while the optional alternative target lives on the right.",
        ],
        items: [
          { label: "Numeric validation", detail: "Inputs clamp to the valid range for the underlying data structure and accept direct typing." },
          { label: "Field picker", detail: "Click a field name to open the searchable dropdown of field IDs and labels." },
          { label: "Direction", detail: "Direction values match the field script expectations (0-255)." },
        ],
      },
      {
        id: "locations-shortcuts",
        title: "Efficiency tips",
        paragraphs: [
          "Keep a second window with the map tab open to verify triangle indices visually. The status bar will reflect unsaved location changes so you know when to commit.",
        ],
      },
    ],
  },
  {
    id: "encounters",
    label: "Encounters",
    icon: Swords,
    summary:
      "View and edit random encounter tables for each world region and terrain type. Edit Yuffie & Chocobo specific encounter data",
    sections: [
      {
        id: "encounters-overview",
        title: "Region management",
        paragraphs: [
          "Landscaper mirrors the in-game region layout. Selecting a region updates the detail panel where you can tweak encounter weights, back attacks, and scene ids.",
        ],
        items: [
          { label: "Terrain sets", detail: "Use the Edit Region Sets dialog to map world geometry chunks to encounter groups." },
          { label: "Set navigation", detail: "Switch between the up to four encounter sets a region can host. The preview includes aggregated probabilities for quick sanity checks." },
        ],
      },
      {
        id: "encounters-views",
        title: "Special views",
        component: EncountersViewTabs,
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
        id: "scripts-navigation",
        title: "Navigation and search",
        paragraphs: [
          "Use the back/forward buttons or their keyboard shortcuts to retrace navigation history across scripts. The search box lets you search for any text string inside the decompiled scripts.",
          "When you switch maps Landscaper keeps the previous selection so you can compare implementations side by side.",
        ],
      },
      {
        id: "scripts-opcodes",
        title: "Opcode reference",
        component: OpcodesByNamespace,
      },
    ],
  },
]
