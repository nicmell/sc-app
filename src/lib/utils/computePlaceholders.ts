import type {LayoutItem} from "react-grid-layout";

export function computePlaceholders(layout: LayoutItem[], cols: number): LayoutItem[] {
  const maxRow = layout.reduce((max, item) => Math.max(max, item.y + item.h), 1);

  // Build occupancy grid
  const grid: boolean[][] = [];
  for (let r = 0; r < maxRow; r++) {
    grid[r] = new Array(cols).fill(false);
  }
  for (const item of layout) {
    for (let r = item.y; r < item.y + item.h; r++) {
      for (let c = item.x; c < item.x + item.w; c++) {
        if (r < maxRow && c < cols) grid[r][c] = true;
      }
    }
  }

  // Greedy scan for empty rectangles
  const placeholders: LayoutItem[] = [];
  let id = 0;

  for (let r = 0; r < maxRow; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c]) continue;

      // Extend right
      let w = 0;
      while (c + w < cols && !grid[r][c + w]) w++;

      // Extend down while full width stays free
      let h = 1;
      outer: while (r + h < maxRow) {
        for (let cc = c; cc < c + w; cc++) {
          if (grid[r + h][cc]) break outer;
        }
        h++;
      }

      // Mark cells as filled
      for (let rr = r; rr < r + h; rr++) {
        for (let cc = c; cc < c + w; cc++) {
          grid[rr][cc] = true;
        }
      }

      placeholders.push({i: `__placeholder-${id++}`, x: c, y: r, w, h});
    }
  }

  return placeholders;
}
