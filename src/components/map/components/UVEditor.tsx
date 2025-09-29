import { Triangle } from "@/ff7/mapfile";
import { useMaps } from "@/hooks/useMaps";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, ClipboardPaste, RefreshCw } from "lucide-react";

interface UVEditorProps {
  triangle: Triangle | null;
  onSave: (uvCoords: { u: number, v: number }[]) => void;
}

const CANVAS_SIZE = 128;

function createImageFromTexture(pixels: Uint8Array, width: number, height: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const imageData = ctx.createImageData(width, height);
  for (let i = 0; i < pixels.length; i += 4) {
    imageData.data[i] = pixels[i];     // Red
    imageData.data[i + 1] = pixels[i + 1]; // Green
    imageData.data[i + 2] = pixels[i + 2]; // Blue
    imageData.data[i + 3] = 255;           // Alpha
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL();
}

export function UVEditor({ triangle, onSave }: UVEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { textures } = useMaps();
  const [selectedVertex, setSelectedVertex] = useState<number | null>(null);
  const [uvCoords, setUvCoords] = useState<{ u: number, v: number }[]>([]);
  const [textureImage, setTextureImage] = useState<HTMLImageElement | null>(null);
  const [copiedUVs, setCopiedUVs] = useState<{ u: number, v: number }[] | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!triangle) {
      setTextureImage(null);
      setSelectedVertex(null);
      return;
    }
    setUvCoords([
      { u: triangle.uVertex0, v: triangle.vVertex0 },
      { u: triangle.uVertex1, v: triangle.vVertex1 },
      { u: triangle.uVertex2, v: triangle.vVertex2 }
    ]);

    const texture = textures[triangle.texture];
    if (!texture?.tex) return;

    const img = new Image();
    img.src = createImageFromTexture(texture.tex.getPixels(), texture.width, texture.height);
    img.onload = () => {
      setTextureImage(img);
    };
  }, [triangle, textures]);

  useEffect(() => {
    if (!triangle || !canvasRef.current || !textureImage) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const texture = textures[triangle.texture];
    if (!texture) return;

    // Calculate scale factor for small textures
    const scaleFactor = (texture.width <= 64 && texture.height <= 64) ? 2 : 1;
    const scaledWidth = texture.width * scaleFactor;
    const scaledHeight = texture.height * scaleFactor;

    const centerX = (CANVAS_SIZE - scaledWidth) / 2;
    const centerY = (CANVAS_SIZE - scaledHeight) / 2;

    ctx.drawImage(textureImage, centerX, centerY, scaledWidth, scaledHeight);

    const wrapUV = (u: number, v: number) => {
      const relU = u - texture.uOffset;
      const relV = v - texture.vOffset;
      const wrappedU = ((relU % texture.width) + texture.width) % texture.width;
      const wrappedV = ((relV % texture.height) + texture.height) % texture.height;
      return {
        u: centerX + wrappedU * scaleFactor,
        v: centerY + wrappedV * scaleFactor
      };
    };

    ctx.beginPath();
    const v0 = wrapUV(uvCoords[0].u, uvCoords[0].v);
    const v1 = wrapUV(uvCoords[1].u, uvCoords[1].v);
    const v2 = wrapUV(uvCoords[2].u, uvCoords[2].v);

    ctx.moveTo(v0.u, v0.v);
    ctx.lineTo(v1.u, v1.v);
    ctx.lineTo(v2.u, v2.v);
    ctx.closePath();

    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 2;
    ctx.stroke();

    uvCoords.forEach(({ u, v }, i) => {
      const isSelected = selectedVertex === i;
      const wrapped = wrapUV(u, v);
      ctx.beginPath();
      ctx.arc(wrapped.u, wrapped.v, isSelected ? 6 : 4, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? '#ff0000' : '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#ff0000';
      ctx.stroke();
    });
  }, [triangle, textures, selectedVertex, uvCoords, textureImage]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !triangle) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const texture = textures[triangle.texture];
    if (!texture) return;

    const scaleFactor = (texture.width <= 64 && texture.height <= 64) ? 2 : 1;
    const scaledWidth = texture.width * scaleFactor;
    const scaledHeight = texture.height * scaleFactor;

    const centerX = (CANVAS_SIZE - scaledWidth) / 2;
    const centerY = (CANVAS_SIZE - scaledHeight) / 2;

    const wrapUV = (u: number, v: number) => {
      const relU = u - texture.uOffset;
      const relV = v - texture.vOffset;
      const wrappedU = ((relU % texture.width) + texture.width) % texture.width;
      const wrappedV = ((relV % texture.height) + texture.height) % texture.height;
      return {
        u: centerX + wrappedU * scaleFactor,
        v: centerY + wrappedV * scaleFactor
      };
    };

    const vertices = uvCoords.map((vertex, i) => {
      const wrapped = wrapUV(vertex.u, vertex.v);
      return {
        index: i,
        x: wrapped.u,
        y: wrapped.v
      };
    });

    const closest = vertices.reduce((prev, curr) => {
      const prevDist = Math.hypot(prev.x - x, prev.y - y);
      const currDist = Math.hypot(curr.x - x, curr.y - y);
      return currDist < prevDist ? curr : prev;
    });

    if (Math.hypot(closest.x - x, closest.y - y) < 10) {
      setSelectedVertex(closest.index);
    } else {
      setSelectedVertex(null);
    }
  };

  const handleUVChange = (index: number, coord: 'u' | 'v', value: string) => {
    const numValue = parseInt(value);
    if (isNaN(numValue)) return;

    const newUVCoords = uvCoords.map((uv, i) => 
      i === index ? { ...uv, [coord]: numValue } : uv
    );
    setUvCoords(newUVCoords);
    onSave(newUVCoords);
  };

  const getTextureScaleAndOffset = () => {
    if (!triangle) return null;
    const texture = textures[triangle.texture];
    if (!texture) return null;

    const scaleFactor = (texture.width <= 64 && texture.height <= 64) ? 2 : 1;
    const scaledWidth = texture.width * scaleFactor;
    const scaledHeight = texture.height * scaleFactor;
    const centerX = (CANVAS_SIZE - scaledWidth) / 2;
    const centerY = (CANVAS_SIZE - scaledHeight) / 2;

    return { texture, scaleFactor, scaledWidth, scaledHeight, centerX, centerY };
  };

  const canvasToUV = (x: number, y: number) => {
    const scaleInfo = getTextureScaleAndOffset();
    if (!scaleInfo) return null;
    const { scaleFactor, centerX, centerY } = scaleInfo;

    const relX = (x - centerX) / scaleFactor;
    const relY = (y - centerY) / scaleFactor;

    return {
      u: Math.round(relX + scaleInfo.texture.uOffset),
      v: Math.round(relY + scaleInfo.texture.vOffset)
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || selectedVertex === null || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const scaleInfo = getTextureScaleAndOffset();
    if (!scaleInfo) return;
    const { scaledWidth, scaledHeight, centerX, centerY } = scaleInfo;

    // Constrain to texture boundaries
    const clampedX = Math.max(centerX, Math.min(centerX + scaledWidth, x));
    const clampedY = Math.max(centerY, Math.min(centerY + scaledHeight, y));

    const newUV = canvasToUV(clampedX, clampedY);
    if (!newUV) return;

    const newUVCoords = uvCoords.map((uv, i) =>
      i === selectedVertex ? { u: newUV.u, v: newUV.v } : uv
    );
    setUvCoords(newUVCoords);
    onSave(newUVCoords);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !triangle) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const scaleInfo = getTextureScaleAndOffset();
    if (!scaleInfo) return;
    const { scaleFactor, centerX, centerY } = scaleInfo;

    const wrapUV = (u: number, v: number) => {
      const relU = u - scaleInfo.texture.uOffset;
      const relV = v - scaleInfo.texture.vOffset;
      const wrappedU = ((relU % scaleInfo.texture.width) + scaleInfo.texture.width) % scaleInfo.texture.width;
      const wrappedV = ((relV % scaleInfo.texture.height) + scaleInfo.texture.height) % scaleInfo.texture.height;
      return {
        u: centerX + wrappedU * scaleFactor,
        v: centerY + wrappedV * scaleFactor
      };
    };

    const vertices = uvCoords.map((vertex, i) => {
      const wrapped = wrapUV(vertex.u, vertex.v);
      return {
        index: i,
        x: wrapped.u,
        y: wrapped.v
      };
    });

    const closest = vertices.reduce((prev, curr) => {
      const prevDist = Math.hypot(prev.x - x, prev.y - y);
      const currDist = Math.hypot(curr.x - x, curr.y - y);
      return currDist < prevDist ? curr : prev;
    });

    if (Math.hypot(closest.x - x, closest.y - y) < 10) {
      setSelectedVertex(closest.index);
      setIsDragging(true);
    } else {
      setSelectedVertex(null);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex space-x-2">
        <div>
          <canvas
            ref={canvasRef}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            className="border border-border bg-black"
            onClick={handleCanvasClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          />
        </div>
        <div className="space-y-2 flex-1 w-24">
          <div>
            <div className="space-y-1">
              {uvCoords.map((coords, i) => (
                <div key={i} className="grid grid-cols-2 gap-1">
                  <div>
                    {i === 0 && <Label className="text-[10px] pl-2 block h-4">U</Label>}
                    <Input
                      type="number"
                      value={coords.u}
                      onChange={(e) => handleUVChange(i, 'u', e.target.value)}
                      className={`h-6 !text-xs w-14 pl-2 pr-1 ${selectedVertex === i ? 'border-red-500' : ''}`}
                    />
                  </div>
                  <div>
                    {i === 0 && <Label className="text-[10px] pl-2 block h-4">V</Label>}
                    <Input
                      type="number"
                      value={coords.v}
                      onChange={(e) => handleUVChange(i, 'v', e.target.value)}
                      className={`h-6 !text-xs w-14 pl-2 pr-1 ${selectedVertex === i ? 'border-red-500' : ''}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex space-x-1">
            <Button 
              variant="outline" 
              size="icon"
              className="h-6 w-6"
              onClick={() => setCopiedUVs(uvCoords)}
              title="Copy UV coordinates"
            >
              <Copy className="h-3 w-3" />
            </Button>
            <Button 
              variant="outline"
              size="icon"
              className="h-6 w-6"
              onClick={() => {
                if (copiedUVs) {
                  setUvCoords(copiedUVs);
                  onSave(copiedUVs);
                }
              }}
              disabled={!copiedUVs}
              title="Paste UV coordinates"
            >
              <ClipboardPaste className="h-3 w-3" />
            </Button>
            <Button 
              variant="outline"
              size="icon"
              className="h-6 w-6"
              onClick={() => {
                const cycledUVs = [
                  uvCoords[2],
                  uvCoords[0],
                  uvCoords[1]
                ];
                setUvCoords(cycledUVs);
                onSave(cycledUVs);
              }}
              title="Cycle UV coordinates"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
} 
