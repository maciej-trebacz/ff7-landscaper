import { useGridSelection } from '@/contexts/GridSelectionContext';
import { Button } from '@/components/ui/button';
import { useMaps } from '@/hooks/useMaps';
import { Mesh } from '@/ff7/mapfile';
import { useTextureAtlas } from '@/hooks/useTextureAtlas';
import { calcUV } from '@/lib/utils';
import { ATLAS_SIZE, MESH_SIZE, TEXTURE_PADDING } from '../constants';
import { useRef, useState } from 'react';
import { WorldMapTexture } from '@/ff7/texfile';
import { Checkbox } from '@/components/ui/checkbox';

// Vector Math Helpers
type Vector3 = { x: number, y: number, z: number };

function subtract(v1: Vector3, v2: Vector3): Vector3 {
  return { x: v1.x - v2.x, y: v1.y - v2.y, z: v1.z - v2.z };
}

function cross(v1: Vector3, v2: Vector3): Vector3 {
  return {
    x: v1.y * v2.z - v1.z * v2.y,
    y: v1.z * v2.x - v1.x * v2.z,
    z: v1.x * v2.y - v1.y * v2.x,
  };
}

function normalize(v: Vector3): Vector3 {
  const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (len === 0) return { x: 0, y: 0, z: 0 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

function add(v1: Vector3, v2: Vector3): Vector3 {
  return { x: v1.x + v2.x, y: v1.y + v2.y, z: v1.z + v2.z };
}

// Helper functions for texture UV conversion
function findTextureForUV(u: number, v: number, texturePositions: Map<number, { x: number, y: number, name: string }>, textures: WorldMapTexture[]): { textureId: number, texture: WorldMapTexture } | null {
  const atlasU = u * ATLAS_SIZE;
  // Flip V coordinate from Blender's space to our space
  const atlasV = (1 - v) * ATLAS_SIZE;

  for (const [id, pos] of texturePositions.entries()) {
    const texture = textures[id];
    if (!texture) continue;

    // Check if the UV point falls within this texture's bounds (including padding)
    if (atlasU >= pos.x - TEXTURE_PADDING && 
        atlasU <= pos.x + texture.width + TEXTURE_PADDING &&
        atlasV >= pos.y - TEXTURE_PADDING && 
        atlasV <= pos.y + texture.height + TEXTURE_PADDING) {
      return { textureId: id, texture };
    }
  }
  return null;
}

function convertAtlasToTextureUV(atlasU: number, atlasV: number, texturePos: { x: number, y: number }, texture: WorldMapTexture): { u: number, v: number } {
  // Convert normalized atlas UV to atlas pixel coordinates
  const atlasPixelU = atlasU * ATLAS_SIZE;
  const atlasPixelV = (1 - atlasV) * ATLAS_SIZE;
  // Compute the local pixel offset within the texture in the atlas
  const deltaU = atlasPixelU - texturePos.x;
  const deltaV = atlasPixelV - texturePos.y;
  // Recover the original editor UV values by adding the texture offset
  const u = texture.uOffset + Math.round(deltaU);
  const v = texture.vOffset + Math.round(deltaV);
  return { u, v };
}

// Helper function to generate a unique key for a triangle based on vertex coordinates
function generateTriangleKey(vertex0: { x: number, y: number, z: number }, vertex1: { x: number, y: number, z: number }, vertex2: { x: number, y: number, z: number }): string {
  // Sort vertices to ensure consistent key regardless of vertex order
  const vertices = [vertex0, vertex1, vertex2].sort((a, b) => {
    if (a.x !== b.x) return a.x - b.x;
    if (a.y !== b.y) return a.y - b.y;
    return a.z - b.z;
  });
  return vertices.map(v => `${v.x},${v.y},${v.z}`).join('|');
}

export function ExportImport() {
  const { selectedCell } = useGridSelection();
  const { worldmap, textures, mapType, updateSectionMesh } = useMaps();
  const { loadTextureAtlas } = useTextureAtlas();
  const { texturePositions, canvas } = loadTextureAtlas(textures, mapType);
  const [resetNormals, setResetNormals] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parser to reverse generateObjContent from an .obj file
  const parseObjFile = (content: string) => {
    const vertices: Array<{ x: number, y: number, z: number }> = [];
    const tempNormals: Array<{ x: number, y: number, z: number }> = []; // Temporary storage for raw normals
    const normals: Array<{ x: number, y: number, z: number }> = []; // Final vertex-mapped normals
    const texCoords: Array<{ u: number, v: number }> = [];
    const triangles: any[] = [];

    // Store normal indices per vertex for later processing
    const vertexToNormalIdx: number[] = [];

    // Create a hash map of existing triangles from the current mesh
    const existingTriangles = new Map<string, { type: number, locationId: number, script: number, isChocobo: boolean }>();
    let originalSectionIdx = 0;
    let originalMeshIdx = 0;
    if (worldmap && selectedCell) {
      const currentMesh = worldmap[selectedCell.row][selectedCell.column];
      // Preserve original file indices to ensure save targets the correct section/mesh
      originalSectionIdx = currentMesh.sectionIdx;
      originalMeshIdx = currentMesh.meshIdx;
      currentMesh.triangles.forEach(triangle => {
        const key = generateTriangleKey(
          triangle.vertex0,
          triangle.vertex1,
          triangle.vertex2
        );
        existingTriangles.set(key, {
          type: triangle.type,
          locationId: triangle.locationId,
          script: triangle.script,
          isChocobo: triangle.isChocobo
        });
      });
    }

    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const parts = trimmed.split(/\s+/);
      if (parts[0] === 'v') {
        // Multiply vertex coordinates by 1024 to reverse the export scaling
        vertices.push({
          x: Math.round(parseFloat(parts[1]) * 1024),
          y: Math.round(parseFloat(parts[2]) * 1024),
          z: Math.round(parseFloat(parts[3]) * 1024)
        });
        // Initialize normal mapping for this vertex
        vertexToNormalIdx.push(-1);
      } else if (parts[0] === 'vn') {
        tempNormals.push({
          x: parseFloat(parts[1]) * 4096,
          y: parseFloat(parts[2]) * 4096,
          z: parseFloat(parts[3]) * 4096
        });
      } else if (parts[0] === 'vt') {
        texCoords.push({
          u: parseFloat(parts[1]),
          v: parseFloat(parts[2])
        });
      } else if (parts[0] === 'f') {
        if (parts.length < 4) continue;
        const vIdx: number[] = [];
        const vtIdx: number[] = [];
        // Process exactly 3 vertices (assuming triangulated faces)
        for (let i = 1; i <= 3; i++) {
          const indices = parts[i].split('/');
          const vertexIndex = parseInt(indices[0]) - 1;
          vIdx.push(vertexIndex);
          
          // Store normal index for this vertex
          if (indices.length > 2) {
            const normalIndex = parseInt(indices[2]) - 1;
            // Ensure normalIndex is valid before assignment
            if (normalIndex >= 0 && normalIndex < tempNormals.length) {
                vertexToNormalIdx[vertexIndex] = normalIndex;
            } else {
                vertexToNormalIdx[vertexIndex] = -1; // Mark as invalid/missing normal
            }
          } else {
            vertexToNormalIdx[vertexIndex] = -1; // Mark as missing normal
          }

          if (indices.length > 1 && indices[1] !== '') {
            vtIdx.push(parseInt(indices[1]) - 1);
          } else {
            vtIdx.push(-1);
          }
        }

        // Get texture coordinates for all vertices
        const uvs = vtIdx.map(idx => idx >= 0 ? texCoords[idx] : null);
        
        // Try to find the texture this triangle belongs to using the first vertex's UVs
        let textureInfo = uvs[0] ? findTextureForUV(uvs[0].u, uvs[0].v, texturePositions, textures) : null;
        
        // If we found a texture, convert all UVs to texture-local coordinates
        let textureUVs: { u: number, v: number }[] = [];
        if (textureInfo && uvs.every(uv => uv)) {
          const pos = texturePositions.get(textureInfo.textureId)!;
          textureUVs = uvs.map(uv => convertAtlasToTextureUV(uv!.u, uv!.v, pos, textureInfo!.texture));
        }

        // Check if there's a matching triangle in the existing mesh
        const triangleKey = generateTriangleKey(
          vertices[vIdx[0]],
          vertices[vIdx[1]],
          vertices[vIdx[2]]
        );
        const existingTriangle = existingTriangles.get(triangleKey);

        triangles.push({
          vertex0: vertices[vIdx[0]],
          vertex1: vertices[vIdx[1]],
          vertex2: vertices[vIdx[2]],
          normal0: tempNormals[vertexToNormalIdx[vIdx[0]]],
          normal1: tempNormals[vertexToNormalIdx[vIdx[1]]],
          normal2: tempNormals[vertexToNormalIdx[vIdx[2]]],
          texture: textureInfo?.textureId ?? 0,
          uVertex0: textureUVs[0]?.u ?? 0,
          vVertex0: textureUVs[0]?.v ?? 0,
          uVertex1: textureUVs[1]?.u ?? 0,
          vVertex1: textureUVs[1]?.v ?? 0,
          uVertex2: textureUVs[2]?.u ?? 0,
          vVertex2: textureUVs[2]?.v ?? 0,
          type: existingTriangle?.type ?? 0,
          locationId: existingTriangle?.locationId ?? 0,
          script: existingTriangle?.script ?? 0,
          isChocobo: existingTriangle?.isChocobo ?? false,
          index: triangles.length
        });
      }
    }

    // Map normals to vertices using the stored indices OR recalculate if resetNormals is true
    if (resetNormals) {
      // Recalculate normals based on triangle geometry
      const calculatedNormals: Vector3[] = vertices.map(() => ({ x: 0, y: 0, z: 0 }));

      triangles.forEach(triangle => {
        const v0 = triangle.vertex0;
        const v1 = triangle.vertex1;
        const v2 = triangle.vertex2;

        // Calculate edges
        const edge1 = subtract(v1, v0);
        const edge2 = subtract(v2, v0);

        // Calculate face normal (cross product)
        const faceNormal = cross(edge1, edge2);

        // Find the indices of the vertices in the main vertices array
        // This assumes triangle.vertexN holds the actual vertex objects
        // We need a way to map back to the original vertex index if they are copies.
        // Let's find indices based on object reference or coordinate match.
        // Assuming triangle.vertexN are direct references or have unique coords for lookup:
        const v0Idx = vertices.findIndex(v => v.x === v0.x && v.y === v0.y && v.z === v0.z);
        const v1Idx = vertices.findIndex(v => v.x === v1.x && v.y === v1.y && v.z === v1.z);
        const v2Idx = vertices.findIndex(v => v.x === v2.x && v.y === v2.y && v.z === v2.z);

        // Add face normal to each vertex normal
        if (v0Idx !== -1) calculatedNormals[v0Idx] = add(calculatedNormals[v0Idx], faceNormal);
        if (v1Idx !== -1) calculatedNormals[v1Idx] = add(calculatedNormals[v1Idx], faceNormal);
        if (v2Idx !== -1) calculatedNormals[v2Idx] = add(calculatedNormals[v2Idx], faceNormal);
      });

      // Normalize and scale each vertex normal
      for (let i = 0; i < calculatedNormals.length; i++) {
        let norm = normalize(calculatedNormals[i]);
        // Scale to FF7's normal magnitude and flip Y
        normals.push({ x: -norm.x * 4096, y: norm.y * 4096, z: norm.z * 4096 });
      }
    } else {
      // Use normals from the OBJ file or default if missing
      for (let i = 0; i < vertices.length; i++) {
        const normalIdx = vertexToNormalIdx[i];
        // Use OBJ normal if valid, otherwise default to flat normal
        normals.push(normalIdx >= 0 ? tempNormals[normalIdx] : { x: 0, y: -4096, z: 0 });
      }
    }

    // Construct a new Mesh object (plain object matching Mesh interface)
    const newMesh = { 
      sectionIdx: originalSectionIdx,
      meshIdx: originalMeshIdx,
      vertices, 
      normals, 
      triangles, 
      numVertices: vertices.length, 
      numTriangles: triangles.length, 
      severity: 1 
    };
    return newMesh;
  };

  const handleFileChosen = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      try {
        const newMesh = parseObjFile(text);

        // Check vertex count and prompt user if too many vertices
        if (newMesh.vertices.length > 122) {
          const proceed = confirm("Importing a mesh with more than 122 vertices will cause visual glitches in the game. Do you want to proceed?");
          if (!proceed) {
            // Reset the file input value so the same file can be imported again
            if (fileInputRef.current) {
              fileInputRef.current.value = '';
            }
            return;
          }
        }

        // Update the worldmap for the selected cell using updateSectionMesh
        updateSectionMesh(selectedCell.row, selectedCell.column, newMesh);
        console.log('Imported mesh', newMesh);
      } catch (err) {
        console.error('Error parsing .obj file', err);
      }
      // Reset the file input value so the same file can be imported again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleImportSectionClick = () => {
    fileInputRef.current?.click();
  };

  if (!selectedCell) {
    return (
      <div className="text-xs text-muted-foreground rounded-md border bg-muted/50 p-2"> 
          Click on a map section to proceed
      </div>
    );
  }

  const generateMtlContent = (mapType?: string) => {
    let mtlContent = '# FF7 World Map Material\n\n';
    mtlContent += 'newmtl ff7_terrain\n';
    mtlContent += 'Ka 1.000 1.000 1.000\n';  // Ambient color
    mtlContent += 'Kd 1.000 1.000 1.000\n';  // Diffuse color
    mtlContent += 'Ks 0.000 0.000 0.000\n';  // Specular color
    mtlContent += 'd 1.0\n';                 // Opacity
    mtlContent += 'illum 1\n';               // Illumination model
    const textureAtlasName = mapType ? `texture_atlas_${mapType}.png` : 'texture_atlas.png';
    mtlContent += `map_Kd ${textureAtlasName}\n`; // Diffuse texture map
    return mtlContent;
  };

  const generateObjContent = (mesh: Mesh, offsetX: number = 0, offsetZ: number = 0, baseVertexIndex: number = 0, baseNormalIndex: number = 0, baseTexCoordIndex: number = 0) => {
    let objContent = '';
    let vertexCount = 0;
    let normalCount = 0;
    let texCoordCount = 0;

    // Add vertices with offset
    mesh.vertices.forEach((vertex) => {
      const x = (vertex.x + offsetX) / 1024;
      const y = vertex.y / 1024;
      const z = (vertex.z + offsetZ) / 1024;
      objContent += `v ${x.toFixed(6)} ${y.toFixed(6)} ${z.toFixed(6)}\n`;
      vertexCount++;
    });

    objContent += '\n';

    // Add vertex normals
    mesh.normals.forEach((normal) => {
      // Scale normals by 1/1024 to match vertex scaling
      const x = normal.x / 1024;
      const y = normal.y / 1024;
      const z = normal.z / 1024;
      objContent += `vn ${x.toFixed(6)} ${y.toFixed(6)} ${z.toFixed(6)}\n`;
      normalCount++;
    });

    objContent += '\n';

    // Add texture coordinates
    mesh.triangles.forEach((triangle) => {
      const texture = textures[triangle.texture];
      const isUnderwaterOutside = texture?.name.includes("cltr") && triangle.uVertex0 === 254;
      if (texture && texturePositions.has(triangle.texture) && !isUnderwaterOutside) {
        const pos = texturePositions.get(triangle.texture)!;
        
        // Calculate UVs using the same method as in WorldMesh
        const u0 = (pos.x + calcUV(triangle.uVertex0, texture.uOffset, texture.width)) / ATLAS_SIZE;
        const v0 = 1 - (pos.y + calcUV(triangle.vVertex0, texture.vOffset, texture.height)) / ATLAS_SIZE;
        const u1 = (pos.x + calcUV(triangle.uVertex1, texture.uOffset, texture.width)) / ATLAS_SIZE;
        const v1 = 1 - (pos.y + calcUV(triangle.vVertex1, texture.vOffset, texture.height)) / ATLAS_SIZE;
        const u2 = (pos.x + calcUV(triangle.uVertex2, texture.uOffset, texture.width)) / ATLAS_SIZE;
        const v2 = 1 - (pos.y + calcUV(triangle.vVertex2, texture.vOffset, texture.height)) / ATLAS_SIZE;

        objContent += `vt ${u0.toFixed(6)} ${v0.toFixed(6)}\n`;
        objContent += `vt ${u1.toFixed(6)} ${v1.toFixed(6)}\n`;
        objContent += `vt ${u2.toFixed(6)} ${v2.toFixed(6)}\n`;
        texCoordCount += 3;
      }
    });

    objContent += '\n';

    // Add faces (triangles)
    let vtIndex = baseTexCoordIndex + 1; // Keep track of texture coordinate indices
    mesh.triangles.forEach((triangle) => {
      const vertexIndex = mesh.vertices.findIndex(v => v === triangle.vertex0);
      const vertex1Index = mesh.vertices.findIndex(v => v === triangle.vertex1);
      const vertex2Index = mesh.vertices.findIndex(v => v === triangle.vertex2);
      
      const texture = textures[triangle.texture];
      const isUnderwaterOutside = texture?.name.includes("cltr") && triangle.uVertex0 === 254;
      if (texture && texturePositions.has(triangle.texture) && !isUnderwaterOutside) {
        // Each vertex in face references vertex/texture/normal indices
        objContent += `f ${vertexIndex + baseVertexIndex + 1}/${vtIndex}/${vertexIndex + baseNormalIndex + 1} ${vertex1Index + baseVertexIndex + 1}/${vtIndex + 1}/${vertex1Index + baseNormalIndex + 1} ${vertex2Index + baseVertexIndex + 1}/${vtIndex + 2}/${vertex2Index + baseNormalIndex + 1}\n`;
        vtIndex += 3;
      } else {
        // If no texture, only use vertex and normal indices
        objContent += `f ${vertexIndex + baseVertexIndex + 1}//${vertexIndex + baseNormalIndex + 1} ${vertex1Index + baseVertexIndex + 1}//${vertex1Index + baseNormalIndex + 1} ${vertex2Index + baseVertexIndex + 1}//${vertex2Index + baseNormalIndex + 1}\n`;
      }
    });

    return {
      content: objContent,
      vertexCount,
      normalCount,
      texCoordCount
    };
  };

  const handleExportSection = () => {
    if (!worldmap || !canvas || !mapType) return;

    const mesh = worldmap[selectedCell.row][selectedCell.column];
    let objContent = '# FF7 World Map Section Export\n';
    objContent += `# Row: ${selectedCell.row}, Column: ${selectedCell.column}\n\n`;
    objContent += `mtllib section_${mapType}.mtl\n\n`;
    objContent += 'usemtl ff7_terrain\n\n';
    objContent += generateObjContent(mesh).content;
    const mtlContent = generateMtlContent(mapType);

    // Create blobs and trigger downloads
    const objBlob = new Blob([objContent], { type: 'text/plain' });
    const mtlBlob = new Blob([mtlContent], { type: 'text/plain' });

    // Export texture atlas as PNG
    canvas.toBlob((textureBlob) => {
      if (textureBlob) {
        const textureUrl = URL.createObjectURL(textureBlob);
        const textureLink = document.createElement('a');
        textureLink.href = textureUrl;
        textureLink.download = `texture_atlas_${mapType}.png`;
        document.body.appendChild(textureLink);
        textureLink.click();
        document.body.removeChild(textureLink);
        URL.revokeObjectURL(textureUrl);
      }
    }, 'image/png');

    // Download OBJ file
    const objUrl = URL.createObjectURL(objBlob);
    const objLink = document.createElement('a');
    objLink.href = objUrl;
    objLink.download = `section_${mapType}_r${selectedCell.row}_c${selectedCell.column}.obj`;
    document.body.appendChild(objLink);
    objLink.click();
    document.body.removeChild(objLink);
    URL.revokeObjectURL(objUrl);

    // Download MTL file
    const mtlUrl = URL.createObjectURL(mtlBlob);
    const mtlLink = document.createElement('a');
    mtlLink.href = mtlUrl;
    mtlLink.download = `section_${mapType}.mtl`;
    document.body.appendChild(mtlLink);
    mtlLink.click();
    document.body.removeChild(mtlLink);
    URL.revokeObjectURL(mtlUrl);
  };

  const handleExportFullMap = () => {
    if (!worldmap || !canvas || !mapType) return;

    let objContent = '# FF7 World Map Full Export\n\n';
    objContent += `mtllib worldmap_${mapType}.mtl\n\n`;
    objContent += 'usemtl ff7_terrain\n\n';

    let baseVertexIndex = 0;
    let baseNormalIndex = 0;
    let baseTexCoordIndex = 0;

    // Process each section
    for (let row = 0; row < worldmap.length; row++) {
      for (let col = 0; col < worldmap[row].length; col++) {
        const mesh = worldmap[row][col];
        if (!mesh) continue;

        // Calculate offsets based on grid position
        const offsetX = col * MESH_SIZE;
        const offsetZ = row * MESH_SIZE;

        // Generate content for this section
        const result = generateObjContent(mesh, offsetX, offsetZ, baseVertexIndex, baseNormalIndex, baseTexCoordIndex);
        objContent += result.content;

        // Update base indices for the next section
        baseVertexIndex += result.vertexCount;
        baseNormalIndex += result.normalCount;
        baseTexCoordIndex += result.texCoordCount;
      }
    }

    const mtlContent = generateMtlContent(mapType);

    // Create blobs and trigger downloads
    const objBlob = new Blob([objContent], { type: 'text/plain' });
    const mtlBlob = new Blob([mtlContent], { type: 'text/plain' });

    // Export texture atlas as PNG
    canvas.toBlob((textureBlob) => {
      if (textureBlob) {
        const textureUrl = URL.createObjectURL(textureBlob);
        const textureLink = document.createElement('a');
        textureLink.href = textureUrl;
        textureLink.download = `texture_atlas_${mapType}.png`;
        document.body.appendChild(textureLink);
        textureLink.click();
        document.body.removeChild(textureLink);
        URL.revokeObjectURL(textureUrl);
      }
    }, 'image/png');

    // Download OBJ file
    const objUrl = URL.createObjectURL(objBlob);
    const objLink = document.createElement('a');
    objLink.href = objUrl;
    objLink.download = `worldmap_${mapType}_full.obj`;
    document.body.appendChild(objLink);
    objLink.click();
    document.body.removeChild(objLink);
    URL.revokeObjectURL(objUrl);

    // Download MTL file
    const mtlUrl = URL.createObjectURL(mtlBlob);
    const mtlLink = document.createElement('a');
    mtlLink.href = mtlUrl;
    mtlLink.download = `worldmap_${mapType}.mtl`;
    document.body.appendChild(mtlLink);
    mtlLink.click();
    document.body.removeChild(mtlLink);
    URL.revokeObjectURL(mtlUrl);
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Selected section: Row {selectedCell.row}, Column {selectedCell.column}
      </p>
      <div className="space-y-1">
        <Button 
          variant="secondary" 
          size="sm" 
          onClick={handleExportSection}
          className="w-full"
        >
          Export section
        </Button>
        <Button 
          variant="secondary" 
          size="sm" 
          onClick={handleImportSectionClick}
          className="w-full"
        >
          Import section
        </Button>
        <div className="flex items-center space-x-2 py-1">
          <Checkbox 
            id="reset-normals" 
            checked={resetNormals}
            onCheckedChange={(checked) => setResetNormals(checked === true)}
          />
          <label
            htmlFor="reset-normals"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Reset imported normals
          </label>
        </div>
        <br />
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleExportFullMap}
          className="w-full"
        >
          Export full map
        </Button>
      </div>
      {/* Hidden file input for importing .obj files */}
      <input
        type="file"
        accept=".obj"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileChosen}
      />
    </div>
  );
}
