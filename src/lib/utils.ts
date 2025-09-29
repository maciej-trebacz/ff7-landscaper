import { clsx, type ClassValue } from "clsx"
import { useEffect, useRef } from "react";
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const calcUV = (value: number, offset: number, dimension: number) => {
  if (value + offset === dimension) return value - 1;
  if (offset > value) {
    offset = offset % dimension;
  }
  return Math.abs((value - offset) % dimension);
}

export function useTraceUpdate(props) {
  const prev = useRef(props);
  useEffect(() => {
    const changedProps = Object.entries(props).reduce((ps, [k, v]) => {
      if (prev.current[k] !== v) {
        ps[k] = [prev.current[k], v];
      }
      return ps;
    }, {});
    if (Object.keys(changedProps).length > 0) {
      console.log('Changed props:', changedProps);
    }
    prev.current = props;
  });
}