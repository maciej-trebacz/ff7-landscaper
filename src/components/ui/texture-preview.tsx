import { cn } from "@/lib/utils"

interface TexturePreviewProps {
  src?: string
  alt: string
  className?: string
  size?: number
}

export function TexturePreview({ src, alt, className, size = 32 }: TexturePreviewProps) {
  if (!src) {
    return (
      <div 
        className={cn(
          "bg-muted border border-border flex items-center justify-center text-xs text-muted-foreground",
          className
        )}
        style={{ width: size, height: size }}
      >
        ?
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className={cn(
        "border border-border",
        className
      )}
      style={{
        width: size,
        height: size,
        imageRendering: 'pixelated',
        objectFit: 'contain'
      }}
    />
  )
}
