# World map loading, saving, store & geometry manipulation functions

## Glossary

* Map - worldmap data for Final Fantasy VII
* Map ID - identifier of one of the available worldmaps in the game
* Map Type - human readable name for worldmaps, one of three avalable values: overworld (id: 0), underwater (id: 2), glacier (id: 3)
* Section - each worldmap is divided into sections that form a grid. Map 0 (overworld) has 9 columns and 7 rows (63 sections in total), Map 2 is 3x4 (12 sections) and Map 3 is 2x2 (4 sections). Each section contains a 4x4 subgrid of 16 meshes. Sections are stored in the game's data sequentially, each has its own index starting from 0.
* Mesh - a group of map triangle data that form a square area of 8192 units
* Alternatives - overworld map has alternate worldmap sections that can be turned on by the game based on current progression. There are 6 different sections (stored in game's data directly after the 63 normal sections) that can be swapped out, grouped together into 4 groups tied to in-game events and locations. These are, in order: "Temple of Ancients gone": [50], "Junon Area crater": [41, 42], "Mideel after Lifestream": [60], "Cosmo Canyon crater" [47, 48]
* Triangle - 3d geometry that's used both for rendering and walkmesh purposes. Each triangle contains additional information such as texture, script triggers, chocobo flag, region id and terrain type

## useMaps hook

This hook is responsible for storing and manipulation worldmap geometry.
It loads the raw map data (from mapfile.ts), parses it and stores it for rendering and editing purposes.
First time a map with particular ID loads it is stored in `maps` array and it gets reused. Multiple maps
may be loaded in at the same time. Uses Jotai for data storage to keep track of the following structure:

{
  mapId: number; // Map ID that's currently viewed in the editor
  mode: 'select', 'export'; // Different editor modes
  maps: [ // Array of loaded worldmap data
    {
      id: number; // map id
      changedMeshes: Mesh[]; // Array of meshed that were modified since last save
      enabledAlternatives: number[]; // Array containing a list of enabled alternative group indices, values 0-3 
      selectedTriangles: Triangle[]; // Triangles currently being edited by the user
      meshCache: Mesh[]; // When mesh data is loaded for the first time it is cached here to avoid recalculations
      map: MapFile
    }
  ],
}

Triangle vertices use local coordinates inside their mesh.
useMaps hook provides various helper methods:

1. Methods to convert between local and global coordinates, e.g.:

```
const SCALE = 0.05; // for rendering purposes
const MESH_SIZE = 8192;

const offsetX = column * MESH_SIZE;
const offsetZ = row * MESH_SIZE;
const globalX = (localX + offsetX) * SCALE;
const globalY = localY * SCALE;
const globalZ = (localZ + offsetZ) * SCALE;
```

Global coordinates are used for rendering the whole map in one view.

2. Loading mesh data: `getMesh(mapId: number, row: number, column: number): Mesh`

It loads the specific mesh by calculating its row & column index and using map.readMesh(), taking into account 
enabled alternatives, returning alternative meshes when applicable.

3. Loading map data given a Map ID.

4. Saving map data. It uses the changedMeshes array and invokes map.writeMesh() for each of them

5. Setters for changing mode, adding a mesh to changedMeshes list, setting alternatives & changing selectedTriangles.

## Performance

Since the world map contains dozens of sections, each with 16 meshes, and each mesh contains 100+ vertices & triangles
performance is an important factor to be considered in this implementation. Use caching where possible without compromising
the ability to edit the data and see the results in real time. Enabling alternatives specifically should be done in a way
that only reloads the sections that are being overriden.
