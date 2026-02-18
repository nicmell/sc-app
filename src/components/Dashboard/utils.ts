import type {BoxItem} from "@/types/stores";
import {LayoutItem} from "react-grid-layout";

const PLACEHOLDER_PREFIX = "__placeholder";

export const MARGIN: [number, number] = [10, 10];

function findMaxRect(grid: number[][], rows: number, cols: number) {
  let bestArea = 0;
  let best: {x: number; y: number; w: number; h: number} | null = null;

  const heights: number[][] = [];
  for (let i = 0; i < rows; i++) {
    heights[i] = new Array(cols).fill(0);
    for (let j = 0; j < cols; j++) {
      if (grid[i][j] === 0) {
        heights[i][j] = (i > 0 ? heights[i - 1][j] : 0) + 1;
      }
    }
  }

  for (let i = 0; i < rows; i++) {
    const h = heights[i];
    const stack: number[] = [];

    for (let j = 0; j <= cols; j++) {
      const curr = j < cols ? h[j] : 0;
      while (stack.length > 0 && h[stack[stack.length - 1]] > curr) {
        const rectH = h[stack.pop()!];
        const rectX = stack.length > 0 ? stack[stack.length - 1] + 1 : 0;
        const rectW = j - rectX;
        const area = rectH * rectW;
        if (area > bestArea) {
          bestArea = area;
          best = {x: rectX, y: i - rectH + 1, w: rectW, h: rectH};
        }
      }
      stack.push(j);
    }
  }

  return best;
}

export function computePlaceholders(layout: BoxItem[], rows: number, cols: number): BoxItem[] {
  const grid: number[][] = [];
  for (let i = 0; i < rows; i++) {
    grid[i] = new Array(cols).fill(0);
  }
  for (const item of layout) {
    for (let i = item.y; i < item.y + item.h; i++) {
      for (let j = item.x; j < item.x + item.w; j++) {
        if (i < rows && j < cols) grid[i][j] = 1;
      }
    }
  }

  const placeholders: BoxItem[] = [];
  let id = 0;

  let rect: ReturnType<typeof findMaxRect>;
  while ((rect = findMaxRect(grid, rows, cols))) {
    placeholders.push({i: `${PLACEHOLDER_PREFIX}-${id++}`, x: rect.x, y: rect.y, w: rect.w, h: rect.h});
    for (let r = rect.y; r < rect.y + rect.h; r++) {
      for (let c = rect.x; c < rect.x + rect.w; c++) {
        grid[r][c] = 1;
      }
    }
  }

  return placeholders;
}

export function toPixelStyle(item: BoxItem, containerWidth: number, cols: number, rowHeight: number) {
  const [mx, my] = MARGIN;
  const colWidth = (containerWidth - mx * (cols + 1)) / cols;

  const left = Math.round((colWidth + mx) * item.x + mx);
  const top = Math.round((rowHeight + my) * item.y + my);
  const width = Math.round(colWidth * item.w + Math.max(0, item.w - 1) * mx);
  const height = Math.round(rowHeight * item.h + Math.max(0, item.h - 1) * my);

  return {left, top, width, height};
}

export const isPlaceholder = ({i}: LayoutItem) => {
  return i.startsWith(PLACEHOLDER_PREFIX)
}
