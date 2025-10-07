import { Label } from "@/components/ui/label"
import type { CallContext } from "@/components/script/types"
import { Description } from "@/components/script/Description"

export function PointSetRadiusUI({
  ctx,
  onBatch,
}: {
  ctx: CallContext
  onBatch: (updates: Array<{ index: number; newText: string }>) => void
}) {
  const innerRadius = parseInt(ctx.args[0]?.text || "0", 10) || 0
  const outerRadius = parseInt(ctx.args[1]?.text || "0", 10) || 0
  
  const handleInnerRadiusChange = (value: number) => {
    onBatch([{ index: 0, newText: String(value) }])
  }
  
  const handleOuterRadiusChange = (value: number) => {
    onBatch([{ index: 1, newText: String(value) }])
  }

  const containerSize = 320
  const centerX = containerSize / 2
  const centerY = containerSize / 2
  
  // Scale so that radius 8 appears as 10px (diameter 20px = one grid square)
  const scale = 10 / 8 // 1.25
  const scaledInnerRadius = innerRadius * scale
  const scaledTotalOuterRadius = (innerRadius + outerRadius) * scale
  const gradientId = `outerGradient-${ctx.row}`
  const innerOffset = scaledTotalOuterRadius > 0 ? scaledInnerRadius / scaledTotalOuterRadius : 0

  return (
    <div className="space-y-4">
      <div className="text-xs font-medium">
        {ctx.namespace}.{ctx.method}
      </div>
      {ctx.description && <Description>{ctx.description}</Description>}
      
      {/* Sliders */}
      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">
            Outer Radius: {outerRadius}
          </Label>
          <input
            type="range"
            className="w-full"
            min={0}
            max={255}
            step={1}
            value={outerRadius}
            onChange={(e) => handleOuterRadiusChange(parseInt(e.target.value, 10))}
          />
        </div>
        
        <div className="space-y-1">
          <Label className="text-xs">
            Inner Radius: {innerRadius}
          </Label>
          <input
            type="range"
            className="w-full"
            min={0}
            max={255}
            step={1}
            value={innerRadius}
            onChange={(e) => handleInnerRadiusChange(parseInt(e.target.value, 10))}
          />
        </div>
      </div>

      {/* Visualization */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Visualization</Label>
        <div 
          className="border border-border rounded-md bg-background relative overflow-hidden"
          style={{ width: containerSize, height: containerSize }}
        >
          <svg 
            width={containerSize} 
            height={containerSize} 
            className="absolute inset-0"
          >
            {/* Grid lines */}
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#cccccc" strokeWidth="0.5" opacity="0.3"/>
              </pattern>
              {scaledTotalOuterRadius > scaledInnerRadius && (
                <radialGradient
                  id={gradientId}
                  gradientUnits="userSpaceOnUse"
                  cx={centerX}
                  cy={centerY}
                  r={scaledTotalOuterRadius}
                >
                  {/* No effect inside inner radius */}
                  <stop
                    offset={`${Math.max(0, (innerOffset - 0.001) * 100)}%`}
                    stopColor="hsl(var(--primary))"
                    stopOpacity="0"
                  />
                  {/* Start fade exactly at inner radius */}
                  <stop
                    offset={`${Math.max(0, Math.min(1, innerOffset)) * 100}%`}
                    stopColor="hsl(var(--primary))"
                    stopOpacity="0.4"
                  />
                  {/* Fully faded out at outer radius */}
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
                </radialGradient>
              )}
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
            {scaledTotalOuterRadius > scaledInnerRadius && (
              <circle
                cx={centerX}
                cy={centerY}
                r={scaledTotalOuterRadius}
                fill={`url(#${gradientId})`}
              />
            )}
            
            {/* Outer circle (inner + outer radius) */}
            {scaledTotalOuterRadius > scaledInnerRadius && (
              <circle
                cx={centerX}
                cy={centerY}
                r={scaledTotalOuterRadius}
                fill="none"
                stroke="none"
              />
            )}
            
            {/* Inner circle (inner radius only) */}
            {scaledInnerRadius > 0 && (
              <circle
                cx={centerX}
                cy={centerY}
                r={scaledInnerRadius}
                fill="hsl(var(--primary))"
                fillOpacity="0.4"
                stroke="hsl(var(--primary))"
                strokeWidth="2"
              />
            )}
            
            {/* Center point */}
            <circle
              cx={centerX}
              cy={centerY}
              r="2"
              fill="hsl(var(--foreground))"
            />
          </svg>
        </div>
        <p className="text-xs text-muted-foreground">
          Grid lines represent mesh lines. 8 units is roughly the size of one mesh square.
        </p>
      </div>
    </div>
  )
}
