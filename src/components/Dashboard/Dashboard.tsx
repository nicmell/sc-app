import {useMemo, useState, useCallback} from "react";
import {ResponsiveGridLayout, useContainerWidth, noCompactor} from "react-grid-layout";
import type {Compactor} from "react-grid-layout";
import type {Layout} from "react-grid-layout";
import type {BoxItem} from "@/types/stores";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import {useSelector} from "@/lib/stores/store";
import layoutStore from "@/lib/stores/layout";
import {layoutApi} from "@/lib/stores/api";
import {DashboardPanel} from "@/components/panels/DashboardPanel";
import {deepEqual} from "@/lib/utils/deepEqual";
import "./Dashboard.scss";

const staticCompactor: Compactor = {
  ...noCompactor,
  preventCollision: true,
};

const BREAKPOINTS = {lg: 996, md: 768, sm: 480, xs: 0} as const;
const COLS_MAP = {lg: 12, md: 12, sm: 6, xs: 1} as const;
const ROW_HEIGHT = 60;
const MARGIN: [number, number] = [10, 10];

function findMaxRect(grid: number[][], rows: number, cols: number) {
  const heights: number[][] = [];
  for (let i = 0; i < rows; i++) {
    heights[i] = new Array(cols).fill(0);
    for (let j = 0; j < cols; j++) {
      if (grid[i][j] === 0) {
        heights[i][j] = (i > 0 ? heights[i - 1][j] : 0) + 1;
      }
    }
  }

  let bestArea = 0;
  let best: {x: number; y: number; w: number; h: number} | null = null;

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

function computePlaceholders(layout: BoxItem[], cols: number): BoxItem[] {
  const rows = layout.reduce((max, item) => Math.max(max, item.y + item.h), 1);

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
    placeholders.push({i: `__placeholder-${id++}`, x: rect.x, y: rect.y, w: rect.w, h: rect.h});
    for (let r = rect.y; r < rect.y + rect.h; r++) {
      for (let c = rect.x; c < rect.x + rect.w; c++) {
        grid[r][c] = 1;
      }
    }
  }

  return placeholders;
}

function toPixelStyle(item: BoxItem, containerWidth: number, cols: number) {
  const [mx, my] = MARGIN;
  const colWidth = (containerWidth - mx * (cols - 1) - mx * 2) / cols;

  const left = Math.round((colWidth + mx) * item.x + mx);
  const top = Math.round((ROW_HEIGHT + my) * item.y + my);
  const width = Math.round(colWidth * item.w + Math.max(0, item.w - 1) * mx);
  const height = Math.round(ROW_HEIGHT * item.h + Math.max(0, item.h - 1) * my);

  return {left, top, width, height};
}

function getBreakpointCols(width: number): number {
  if (width >= BREAKPOINTS.lg) return COLS_MAP.lg;
  if (width >= BREAKPOINTS.md) return COLS_MAP.md;
  if (width >= BREAKPOINTS.sm) return COLS_MAP.sm;
  return COLS_MAP.xs;
}

export function Dashboard() {
  const layout = useSelector(layoutStore.selectors.layout);
  const {width, containerRef, mounted} = useContainerWidth({measureBeforeMount: true});
  const [cols, setCols] = useState(() => getBreakpointCols(width));

  const onBreakpointChange = useCallback((_bp: string, newCols: number) => {
    setCols(newCols);
  }, []);

  const placeholders = useMemo(() => computePlaceholders(layout, cols), [layout, cols]);

  const syncLayout = (current: Layout) => {
    const active = current
      .map(({i, x, y, w, h}) => ({i, x, y, w, h}));
    if (!deepEqual(active, layout)) {
      layoutApi.setLayout(active);
    }
  };

  return (
    <div className="dashboard">
      <header className="header">
        <h1>SC-App</h1>
        <button onClick={() => layoutApi.resetLayout()}>Reset Layout</button>
      </header>

      <div className="dashboard-grid-wrapper" ref={containerRef as React.RefObject<HTMLDivElement>}>
        {mounted && (
          <div className="dashboard-grid-container">
            <ResponsiveGridLayout
              className="dashboard-grid"
              width={width}
              layouts={{lg: layout}}
              breakpoints={BREAKPOINTS}
              cols={COLS_MAP}
              rowHeight={ROW_HEIGHT}
              margin={MARGIN}
              compactor={staticCompactor}
              dragConfig={{handle: ".dashboard-panel-header"}}
              onBreakpointChange={onBreakpointChange}
              onDragStop={(current: Layout) => syncLayout(current)}
              onResizeStop={(current: Layout) => syncLayout(current)}
            >
              {layout.map(item => (
                <DashboardPanel
                  key={item.i}
                  title={item.i}
                  onClose={() => layoutApi.removeBox(item.i)}
                />
              ))}
            </ResponsiveGridLayout>

            {placeholders.map(p => (
              <div
                key={p.i}
                className="add-box-placeholder"
                style={toPixelStyle(p, width, cols)}
                onClick={() => layoutApi.addBox({x: p.x, y: p.y, w: p.w, h: p.h})}
              >
                +
              </div>
            ))}
          </div>
        )}
      </div>

      <footer className="footer">
        <span className="server-status">Empty Box Grid</span>
      </footer>
    </div>
  );
}
