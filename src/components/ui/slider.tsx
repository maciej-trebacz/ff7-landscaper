import * as React from "react"

import { cn } from "@/lib/utils"

export interface SliderProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value: number
  onValueChange: (value: number) => void
  min?: number
  max?: number
  step?: number
}

export const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className, value, onValueChange, min = 0, max = 100, step = 1, disabled, ...props }, ref) => {
    return (
      <input
        type="range"
        ref={ref}
        className={cn(
          "appearance-none h-2 w-full rounded-md bg-secondary/50 outline-none disabled:opacity-50",
          "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary",
          "[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary",
          className
        )}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onValueChange(Number(e.currentTarget.value))}
        disabled={disabled}
        {...props}
      />
    )
  }
)
Slider.displayName = "Slider"

export default Slider


