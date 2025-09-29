# FF7 Landscaper - CLAUDE.md

Landscaper is a Final Fantasy VII world map editor built as a Tauri 2.0 desktop application. It directly edits FF7 game files to modify world maps, dialogues, textures, and scripts.

Claude will update this file after finishing tasks as necessary to include new knowledge about the project structure, features, tech stack and more.

## Common Commands

### Development
- `npm run tauri dev` - Run Tauri desktop app in development
- `npm run tauri build` - Build desktop application
- `npm test` - Run Vitest unit tests

### UI Components
- `npx shadcn@latest add <component>` - Add new shadcn-ui components
- Check `components.json` before installing to avoid duplicates

## Architecture

### Tech Stack
- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS + shadcn-ui
- **Backend**: Tauri 2.0 (minimal Rust for OS integration)
- **State**: Jotai atomic state management
- **3D**: Three.js with React Three Fiber
- **Editors**: Ace Editor for Worldscript editing

### Key Directories
- `src/ff7/` - FF7 binary file format parsers (MAP, MES, TEX, LGP, etc.)
- `src/components/tabs/` - Main application features (Messages, Map, Textures, Scripts, Encounters)
- `src/components/map/` - 3D world map viewer and editing tools
- `src/components/script/` - Custom worldscript language editor with syntax highlighting
- `src/hooks/` - Jotai-based state management hooks
- `src-tauri/` - Rust backend (minimal, mostly file operations)

### Core Features
1. **Messages Tab** - Edit FF7 dialogue from `mes` files in `world_us.lgp`
2. **Map Tab** - 3D world map editor for `wmX.MAP` files with multiple rendering modes
3. **Textures Tab** - Texture management for game maps
4. **Scripts Tab** - Custom worldscript language with full parser/editor
5. **Encounters Tab** - Battle encounter editing

## File Format Handling

The app works directly with FF7 binary files using TypeScript parsers in `src/ff7/`:
- World maps: `wmX.MAP` files (geometry, textures, scripts)
- Messages: `mes` files from LGP archives
- Textures: Various texture formats
- Scripts: Custom worldscript bytecode with full language implementation

## UI Guidelines

- Dark theme with "slate" base color scheme
- Sleek, compact design with small buttons and minimal padding
- Use existing shadcn-ui components when possible

## State Management

Uses Jotai for reactive state with domain-specific hooks:
- `useAppState` - Global application state
- `useMaps` - 3D map viewer state
- `useScriptState` - Script editor state
- `useMessagesState` - Message editing state

## 3D Map Editor

The MapViewer component provides a sophisticated 3D editor for FF7 world maps using Three.js and React Three Fiber.

### Key Features
- **Multiple Rendering Modes**: `textured` (full textures), `terrain` (terrain type colors), `region` (region ID colors), `scripts` (script/chocobo data colors)
- **Dual Camera System**: Perspective camera with map-specific heights (Overworld: 10,200, Underwater: 5,800, Great Glacier: 2,900 units) + orthographic option
- **Triangle Selection**: Single-select for detailed editing, painting mode for multi-select with click/drag
- **Visual Overlays**: Wireframe, grid, normals visualization, 3D model overlays
- **Map orientation and Controls**: The map view always starts with the map being visible from the top with the camera being positioned at the center and above the map, and zoomed in just enough to fit the whole map in the viewer container.

### Map Types
- **Overworld**: 9×7 sections (36×28 meshes total)
- **Underwater**: 3×4 sections (12×16 meshes total)  
- **Great Glacier**: 2×2 sections (8×8 meshes total)

### Technical Implementation
- **Coordinate System**: FF7 coordinates scaled by 0.05 factor, 8192 units per mesh section
- **Mesh Construction**: Built from `wmX.MAP` triangle data with cached world positions
- **Texture System**: 2048×2048 texture atlas with positioning maps
- **State Management**: Jotai atoms track modifications, mesh updates, triangle selections
- **Real-time Updates**: Geometry updates immediately via function injection

Key files: `MapViewer.tsx` (main component), `WorldMesh/` (mesh rendering), `useMaps.ts` (state management)

## Testing

After implementing requested changes do NOT run any scripts, just say that you're finished. I'm always having the app open with hot reload turned on so running dev server again is unnecessary.
