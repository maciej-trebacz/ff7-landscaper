import { useMemo, useRef, useCallback, useState, useEffect, startTransition } from 'react';
import * as THREE from 'three';
import { Mesh, Triangle } from '@/ff7/mapfile';
import { WorldMapTexture } from '@/ff7/texfile';
import { MapType, RenderingMode, TriangleWithVertices } from '../../types';
import { LOCATION_COLORS, MESH_SIZE, REGION_COLORS, SCALE, SCRIPT_COLORS, SELECTION_Y_OFFSET, ATLAS_SIZE } from '../../constants';
import { calcUV } from '@/lib/utils';


export function useGeometry(
  worldmap: Mesh[][],
  mapType: MapType,
  renderingMode: RenderingMode,
  textures: WorldMapTexture[],
  texturePositions: Map<number, { x: number, y: number, name: string }>
) {
  const geometryRef = useRef<THREE.BufferGeometry | null>(null);
  const triangleMapRef = useRef<TriangleWithVertices[] | null>(null);
  // New ref to track mapping from vertex ID to positions buffer offsets.
  const vertexOffsetsRef = useRef<Map<number, [number, Triangle][]> | null>(null);
  const [geometryResult, setGeometryResult] = useState<{ geometry: THREE.BufferGeometry | null, triangleMap: TriangleWithVertices[] | null }>({ geometry: null, triangleMap: null });

  const computeGeometry = useCallback(() => {
    if (!worldmap || !worldmap.length) {
      setGeometryResult({ geometry: null, triangleMap: null });
      return;
    }

    // Use startTransition to make this computation non-blocking
    startTransition(() => {
      let totalTris = 0;
      for (const row of worldmap) {
        for (const mesh of row) {
          totalTris += mesh.numTriangles;
        }
      }

      // Allocate buffers (positions, colors, uvs) as before.
      const positions = new Float32Array(totalTris * 3 * 3);
      const colors = new Float32Array(totalTris * 3 * 3);
      const uvs = new Float32Array(totalTris * 3 * 2);

      const triangleMap: TriangleWithVertices[] = [];

      let offset = 0;
      let uvOffset = 0;
      let triangleIndex = 0;

      // For shared vertices, assign a unique ID and record where in the positions buffer they are written.
      let vertexIdCounter = 0;
      const uniqueVertexMap = new Map<string, number>(); // key -> vertexId
      const vertexIdToOffsets = new Map<number, [number, Triangle][]>(); // vertexId -> [offsets]

      const terrainColorMap = LOCATION_COLORS[mapType];
      const regionColorMap = REGION_COLORS[mapType];
      const defaultColor = new THREE.Color('#444');

      // Process each mesh and its triangles
      for (let row = 0; row < worldmap.length; row++) {
        for (let col = 0; col < worldmap[row].length; col++) {
          const mesh = worldmap[row][col];
          const offsetX = col * MESH_SIZE;
          const offsetZ = row * MESH_SIZE;

          for (const tri of mesh.triangles) {
            const transformedVertices = {
              v0: [0, 0, 0] as [number, number, number],
              v1: [0, 0, 0] as [number, number, number],
              v2: [0, 0, 0] as [number, number, number]
            };

            let color: THREE.Color;
            if (renderingMode === "region") {
              const regionIdx = tri.locationId % 32;
              const colorHex = regionColorMap[regionIdx];
              color = colorHex ? new THREE.Color(colorHex) : defaultColor;
            } else if (renderingMode === "terrain") {
              const colorHex = terrainColorMap[tri.type];
              color = colorHex ? new THREE.Color(colorHex) : defaultColor;
            } else if (renderingMode === "scripts") {
              if (tri.isChocobo) {
                color = new THREE.Color(SCRIPT_COLORS.chocobo);
              } else if (tri.script > 0) {
                color = new THREE.Color(SCRIPT_COLORS.script[tri.script as keyof typeof SCRIPT_COLORS.script] || SCRIPT_COLORS.script[8]);
              } else {
                color = new THREE.Color(SCRIPT_COLORS.none);
              }
            } else {
              color = new THREE.Color('#fff');
            }

            // Updated helper: write the vertex, assign a unique vertexId, and record its offset.
            function setPosColor(v: { x: number, y: number, z: number }, vertexIndex: 0 | 1 | 2): number {
              const x = (v.x + offsetX) * SCALE;
              const y = v.y * SCALE;
              const z = (v.z + offsetZ) * SCALE;

              // Use a key based on the absolute position (rounded to avoid floating point issues)
              const key = `${Math.round(x * 1000) / 1000},${Math.round(y * 1000) / 1000},${Math.round(z * 1000) / 1000}`;
              let vertexId: number;
              if (uniqueVertexMap.has(key)) {
                vertexId = uniqueVertexMap.get(key)!;
              } else {
                vertexId = vertexIdCounter++;
                uniqueVertexMap.set(key, vertexId);
                vertexIdToOffsets.set(vertexId, []);
              }
              // Record this occurrence (offset in the positions array) for the vertexId.
              vertexIdToOffsets.get(vertexId)!.push([offset, tri]);

              // Write position and color into buffers.
              positions[offset] = x;
              positions[offset + 1] = y;
              positions[offset + 2] = z;
              colors[offset] = color.r;
              colors[offset + 1] = color.g;
              colors[offset + 2] = color.b;

              // Save transformed vertex.
              transformedVertices[`v${vertexIndex}`] = [x, y, z];
              offset += 3;
              return vertexId;
            }

            // Process each vertex of the triangle and get its unique ID.
            const vertexId0 = setPosColor(tri.vertex0, 0);
            const vertexId1 = setPosColor(tri.vertex1, 1);
            const vertexId2 = setPosColor(tri.vertex2, 2);

            // UV calculation for textured mode
            const texture = textures[tri.texture];
            const isUnderwaterOutside = texture?.name.includes("cltr") && tri.uVertex0 === 254;
            if (texture && texturePositions?.has(tri.texture) && !isUnderwaterOutside) {
              const pos = texturePositions.get(tri.texture)!;
              const u0 = (pos.x + calcUV(tri.uVertex0, texture.uOffset, texture.width)) / ATLAS_SIZE;
              const v0 = (pos.y + calcUV(tri.vVertex0, texture.vOffset, texture.height)) / ATLAS_SIZE;
              const u1 = (pos.x + calcUV(tri.uVertex1, texture.uOffset, texture.width)) / ATLAS_SIZE;
              const v1 = (pos.y + calcUV(tri.vVertex1, texture.vOffset, texture.height)) / ATLAS_SIZE;
              const u2 = (pos.x + calcUV(tri.uVertex2, texture.uOffset, texture.width)) / ATLAS_SIZE;
              const v2 = (pos.y + calcUV(tri.vVertex2, texture.vOffset, texture.height)) / ATLAS_SIZE;

              uvs[uvOffset] = u0;
              uvs[uvOffset + 1] = v0;
              uvs[uvOffset + 2] = u1;
              uvs[uvOffset + 3] = v1;
              uvs[uvOffset + 4] = u2;
              uvs[uvOffset + 5] = v2;
            }
            uvOffset += 6;

            // Save the triangle along with the unique vertex IDs.
            triangleMap.push({
              ...tri,
              transformedVertices,
              meshOffsetX: offsetX,
              meshOffsetZ: offsetZ,
              vertexIds: [vertexId0, vertexId1, vertexId2],
              trianglePtr: mesh.triangles[tri.index]
            });
            triangleIndex++;
          }
        }
      }

      // Save the mapping from vertex IDs to geometry offsets.
      vertexOffsetsRef.current = vertexIdToOffsets;

      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geom.computeVertexNormals();

      geometryRef.current = geom;
      triangleMapRef.current = triangleMap;

      setGeometryResult({ geometry: geom, triangleMap });
    });
  }, [worldmap, mapType, renderingMode, textures, texturePositions]);

  // Trigger geometry computation when dependencies change
  useEffect(() => {
    computeGeometry();
  }, [computeGeometry]);

  const result = geometryResult;

  // Create normal visualization geometry
  const normalsMapRef = useRef<Map<string, number>>(new Map());

  const normalLinesGeometry = useMemo(() => {
    if (!geometryRef.current || !worldmap || !triangleMapRef.current) return null;

    // Count total vertices to allocate buffer
    let totalVertices = 0;
    for (let row = 0; row < worldmap.length; row++) {
      for (let col = 0; col < worldmap[row].length; col++) {
        totalVertices += worldmap[row][col].vertices.length;
      }
    }

    const linePositions = new Float32Array(totalVertices * 6); // 2 points per normal line (start and end)
    let offset = 0;
    normalsMapRef.current.clear();

    // Process each mesh in the worldmap
    for (let row = 0; row < worldmap.length; row++) {
      for (let col = 0; col < worldmap[row].length; col++) {
        const mesh = worldmap[row][col];
        const offsetX = col * MESH_SIZE;
        const offsetZ = row * MESH_SIZE;

        // For each vertex in the mesh
        for (let i = 0; i < mesh.vertices.length; i++) {
          const vertex = mesh.vertices[i];
          const normal = mesh.normals[i];

          // Store the mapping between vertex ID and line position offset
          normalsMapRef.current.set(`${row},${col},${i}`, offset);

          // Scale factor for normal visualization
          const normalScale = 500;

          // Start point of the line (vertex position)
          const startX = (vertex.x + offsetX) * SCALE;
          const startY = vertex.y * SCALE;
          const startZ = (vertex.z + offsetZ) * SCALE;

          // End point of the line (vertex + scaled normal)
          const endX = startX + normal.x * SCALE * normalScale / 4096;
          const endY = startY - normal.y * SCALE * normalScale / 4096;
          const endZ = startZ - normal.z * SCALE * normalScale / 4096;

          // Add line segment
          linePositions[offset] = startX;
          linePositions[offset + 1] = startY;
          linePositions[offset + 2] = startZ;
          linePositions[offset + 3] = endX;
          linePositions[offset + 4] = endY;
          linePositions[offset + 5] = endZ;

          offset += 6;
        }
      }
    }

    const normalGeometry = new THREE.BufferGeometry();
    normalGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
    return normalGeometry;
  }, [geometryRef.current, worldmap, triangleMapRef.current]);

  const updateTriangleUVs = useCallback((
    triangle: TriangleWithVertices,
    uVertex0: number,
    vVertex0: number,
    uVertex1: number,
    vVertex1: number,
    uVertex2: number,
    vVertex2: number
  ) => {
    if (!geometryRef.current || !triangleMapRef.current) return;

    const triangleId = triangleMapRef.current.findIndex(t => t === triangle);
    if (triangleId === -1) return;

    const texture = textures[triangle.texture];
    const pos = texturePositions.get(triangle.texture);
    
    if (!texture || !pos) return;

    const uvAttribute = geometryRef.current.getAttribute('uv') as THREE.BufferAttribute;
    const uvs = uvAttribute.array as Float32Array;

    // Calculate UVs based on texture position in atlas
    const u0 = (pos.x + calcUV(uVertex0, texture.uOffset, texture.width)) / ATLAS_SIZE;
    const v0 = (pos.y + calcUV(vVertex0, texture.vOffset, texture.height)) / ATLAS_SIZE;
    const u1 = (pos.x + calcUV(uVertex1, texture.uOffset, texture.width)) / ATLAS_SIZE;
    const v1 = (pos.y + calcUV(vVertex1, texture.vOffset, texture.height)) / ATLAS_SIZE;
    const u2 = (pos.x + calcUV(uVertex2, texture.uOffset, texture.width)) / ATLAS_SIZE;
    const v2 = (pos.y + calcUV(vVertex2, texture.vOffset, texture.height)) / ATLAS_SIZE;

    // Each triangle takes up 6 UV coordinates (2 per vertex)
    const uvOffset = triangleId * 6;

    uvs[uvOffset] = u0;
    uvs[uvOffset + 1] = v0;
    uvs[uvOffset + 2] = u1;
    uvs[uvOffset + 3] = v1;
    uvs[uvOffset + 4] = u2;
    uvs[uvOffset + 5] = v2;

    // Update the underlying triangle data using trianglePtr
    triangle.trianglePtr.uVertex0 = uVertex0;
    triangle.trianglePtr.vVertex0 = vVertex0;
    triangle.trianglePtr.uVertex1 = uVertex1;
    triangle.trianglePtr.vVertex1 = vVertex1;
    triangle.trianglePtr.uVertex2 = uVertex2;
    triangle.trianglePtr.vVertex2 = vVertex2;

    // Update the triangle in triangleMap
    triangle.uVertex0 = uVertex0;
    triangle.vVertex0 = vVertex0;
    triangle.uVertex1 = uVertex1;
    triangle.vVertex1 = vVertex1;
    triangle.uVertex2 = uVertex2;
    triangle.vVertex2 = vVertex2;

    uvAttribute.needsUpdate = true;
  }, [textures, texturePositions]);

  // Updated updateTrianglePosition using unique vertex IDs.
  const updateTrianglePosition = useCallback((
    triangle: TriangleWithVertices,
    vertex0: [number, number, number],
    vertex1: [number, number, number],
    vertex2: [number, number, number]
  ) => {
    if (!geometryRef.current || !triangleMapRef.current || !vertexOffsetsRef.current) return;

    const positionAttribute = geometryRef.current.getAttribute('position') as THREE.BufferAttribute;
    const positions = positionAttribute.array as Float32Array;
    const newVertices = [vertex0, vertex1, vertex2];

    // For each vertex in the triangle, use its unique ID to update every occurrence.
    triangle.vertexIds.forEach((vertexId, i) => {
      const offsets = vertexOffsetsRef.current?.get(vertexId);
      if (!offsets) return;
      const newX = (newVertices[i][0] + triangle.meshOffsetX) * SCALE;
      const newY = newVertices[i][1] * SCALE;
      const newZ = (newVertices[i][2] + triangle.meshOffsetZ) * SCALE;
      offsets.forEach(([posOffset, tri]) => {
        positions[posOffset] = newX;
        positions[posOffset + 1] = newY;
        positions[posOffset + 2] = newZ;

        const triangle = triangleMapRef.current.find(t => t.trianglePtr === tri);
        if (!triangle) return;
        triangle.transformedVertices[`v${i}`] = [newX, newY, newZ];

      });
      // Update the cached transformed vertices.
      triangle.transformedVertices[`v${i}`] = [newX, newY, newZ];
    });

    // Update the underlying triangle data using trianglePtr
    triangle.trianglePtr.vertex0.x = vertex0[0];
    triangle.trianglePtr.vertex0.y = vertex0[1];
    triangle.trianglePtr.vertex0.z = vertex0[2];
    triangle.trianglePtr.vertex1.x = vertex1[0];
    triangle.trianglePtr.vertex1.y = vertex1[1];
    triangle.trianglePtr.vertex1.z = vertex1[2];
    triangle.trianglePtr.vertex2.x = vertex2[0];
    triangle.trianglePtr.vertex2.y = vertex2[1];
    triangle.trianglePtr.vertex2.z = vertex2[2];

    // Update the triangle in triangleMap
    triangle.vertex0 = { x: vertex0[0], y: vertex0[1], z: vertex0[2] };
    triangle.vertex1 = { x: vertex1[0], y: vertex1[1], z: vertex1[2] };
    triangle.vertex2 = { x: vertex2[0], y: vertex2[1], z: vertex2[2] };

    positionAttribute.needsUpdate = true;
    geometryRef.current.computeVertexNormals();
  }, []);

  const updateColors = useCallback(() => {
    if (!geometryRef.current || !triangleMapRef.current) return;

    const colorAttribute = geometryRef.current.getAttribute('color') as THREE.BufferAttribute;
    const colors = colorAttribute.array as Float32Array;
    const defaultColor = new THREE.Color('#444');
    const terrainColorMap = LOCATION_COLORS[mapType];
    const regionColorMap = REGION_COLORS[mapType];

    triangleMapRef.current.forEach((tri, index) => {
      let color: THREE.Color;
      if (renderingMode === "region") {
        const regionIdx = tri.locationId % 32;
        const colorHex = regionColorMap[regionIdx];
        color = colorHex ? new THREE.Color(colorHex) : defaultColor;
      } else if (renderingMode === "terrain") {
        const colorHex = terrainColorMap[tri.type];
        color = colorHex ? new THREE.Color(colorHex) : defaultColor;
      } else if (renderingMode === "scripts") {
        if (tri.isChocobo) {
          color = new THREE.Color(SCRIPT_COLORS.chocobo);
        } else if (tri.script > 0) {
          color = new THREE.Color(SCRIPT_COLORS.script[tri.script as keyof typeof SCRIPT_COLORS.script] || SCRIPT_COLORS.script[8]);
        } else {
          color = new THREE.Color(SCRIPT_COLORS.none);
        }
      } else {
        color = new THREE.Color('#fff');
      }

      // Each triangle has 3 vertices, each vertex has 3 color components
      const offset = index * 9;
      for (let i = 0; i < 3; i++) {
        colors[offset + i * 3] = color.r;
        colors[offset + i * 3 + 1] = color.g;
        colors[offset + i * 3 + 2] = color.b;
      }
    });

    colorAttribute.needsUpdate = true;
  }, [mapType, renderingMode]);

  const updateTriangleTexture = useCallback((
    triangle: TriangleWithVertices,
  ) => {
    if (!geometryRef.current || !triangleMapRef.current) return;

    const triangleId = triangleMapRef.current.findIndex(t => t === triangle);
    if (triangleId === -1) return;

    const texture = textures[triangle.texture];
    const pos = texturePositions.get(triangle.texture);

    if (!texture || !pos) return;

    const uvAttribute = geometryRef.current.getAttribute('uv') as THREE.BufferAttribute;
    const uvs = uvAttribute.array as Float32Array;

    // Calculate UVs based on texture position in atlas
    const u0 = (pos.x + calcUV(triangle.uVertex0, texture.uOffset, texture.width)) / ATLAS_SIZE;
    const v0 = (pos.y + calcUV(triangle.vVertex0, texture.vOffset, texture.height)) / ATLAS_SIZE;
    const u1 = (pos.x + calcUV(triangle.uVertex1, texture.uOffset, texture.width)) / ATLAS_SIZE;
    const v1 = (pos.y + calcUV(triangle.vVertex1, texture.vOffset, texture.height)) / ATLAS_SIZE;
    const u2 = (pos.x + calcUV(triangle.uVertex2, texture.uOffset, texture.width)) / ATLAS_SIZE;
    const v2 = (pos.y + calcUV(triangle.vVertex2, texture.vOffset, texture.height)) / ATLAS_SIZE;

    // Each triangle takes up 6 UV coordinates (2 per vertex)
    const uvOffset = triangleId * 6;

    uvs[uvOffset] = u0;
    uvs[uvOffset + 1] = v0;
    uvs[uvOffset + 2] = u1;
    uvs[uvOffset + 3] = v1;
    uvs[uvOffset + 4] = u2;
    uvs[uvOffset + 5] = v2;

    uvAttribute.needsUpdate = true;
  }, [textures, texturePositions, triangleMapRef, geometryRef]);

  const updateTriangleNormals = useCallback((
    triangle: TriangleWithVertices,
    normal0: { x: number, y: number, z: number },
    normal1: { x: number, y: number, z: number },
    normal2: { x: number, y: number, z: number }
  ) => {
    if (!geometryRef.current || !triangleMapRef.current || !vertexOffsetsRef.current) return;

    const normalGeometry = normalLinesGeometry;
    if (!normalGeometry) return;

    const positionAttribute = normalGeometry.getAttribute('position') as THREE.BufferAttribute;
    const positions = positionAttribute.array as Float32Array;

    // Scale factor for normal visualization (same as in useGeometry)
    const normalScale = 500;

    const row = triangle.meshOffsetZ / MESH_SIZE;
    const col = triangle.meshOffsetX / MESH_SIZE;

    const i = normal0 ? 0 : normal1 ? 1 : 2;
    const normal = i === 0 ? normal0 : i === 1 ? normal1 : normal2;
    const vertex = triangle.trianglePtr[`vertex${i}`];

    const lineOffset = normalsMapRef.current.get(`${row},${col},${worldmap[row][col].vertices.indexOf(vertex)}`);
    if (lineOffset === undefined) return;

    const offsetX = col * MESH_SIZE;
    const offsetZ = row * MESH_SIZE;

    // Start point of the line (vertex position)
    const startX = (vertex.x + offsetX) * SCALE;
    const startY = vertex.y * SCALE;
    const startZ = (vertex.z + offsetZ) * SCALE;    

    // Start point is the vertex position (already in world space)
    positions[lineOffset] = startX;
    positions[lineOffset + 1] = startY;
    positions[lineOffset + 2] = startZ;

    // End point is vertex + scaled normal
    positions[lineOffset + 3] = startX + normal.x * SCALE * normalScale / 4096;
    positions[lineOffset + 4] = startY - normal.y * SCALE * normalScale / 4096;
    positions[lineOffset + 5] = startZ - normal.z * SCALE * normalScale / 4096;

    positionAttribute.needsUpdate = true;
  }, [normalLinesGeometry]);

  return {
    geometry: result.geometry,
    triangleMap: result.triangleMap,
    normalLinesGeometry,
    updateTriangleUVs,
    updateTrianglePosition,
    updateColors,
    updateTriangleTexture,
    updateTriangleNormals,
  };
}


export function useSelectedTriangleGeometry(triangleMap: TriangleWithVertices[] | null, selectedFaceIndex: number | null) {
  return useMemo(() => {
    if (!triangleMap || selectedFaceIndex === null) {
      return null;
    }

    const tri = triangleMap[selectedFaceIndex];
    if (!tri) return null;

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(9);
    positions[0] = tri.transformedVertices.v0[0];
    positions[1] = tri.transformedVertices.v0[1] + SELECTION_Y_OFFSET;
    positions[2] = tri.transformedVertices.v0[2];
    positions[3] = tri.transformedVertices.v1[0];
    positions[4] = tri.transformedVertices.v1[1] + SELECTION_Y_OFFSET;
    positions[5] = tri.transformedVertices.v1[2];
    positions[6] = tri.transformedVertices.v2[0];
    positions[7] = tri.transformedVertices.v2[1] + SELECTION_Y_OFFSET;
    positions[8] = tri.transformedVertices.v2[2];

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();

    return geometry;
  }, [triangleMap, selectedFaceIndex]);
}