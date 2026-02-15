import {useState, useEffect, useMemo, useSyncExternalStore} from "react";
import {GridLayout, useContainerWidth, noCompactor} from "react-grid-layout";
import type {Layout} from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import {useSelector} from "@/lib/stores/store";
import layoutStore from "@/lib/stores/layout";
import {layoutApi} from "@/lib/stores/api";
import {DashboardPanel} from "@/components/DashboardPanel";
import {deepEqual} from "@/lib/utils/deepEqual";
import {SettingsDrawer} from "@/components/SettingsDrawer";
import {pluginManager} from "@/lib/plugins/PluginManager";
import {MARGIN, computePlaceholders, toPixelStyle} from "./utils";
import "./Dashboard.scss";

const HEADER_HEIGHT = 75;
const FOOTER_HEIGHT = 42;

function subscribeToResize(cb: () => void) {
  window.addEventListener("resize", cb);
  return () => window.removeEventListener("resize", cb);
}

function getViewportHeight() {
  return window.innerHeight;
}

function computeRowHeight(numRows: number, viewportHeight: number): number {
  const available = viewportHeight - HEADER_HEIGHT - FOOTER_HEIGHT;
  return Math.floor((available - MARGIN[1] * (numRows + 1)) / numRows);
}

export function Dashboard() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pluginsLoading, setPluginsLoading] = useState(true);
  const layout = useSelector(layoutStore.selectors.items);
  const {numRows, numColumns} = useSelector(layoutStore.selectors.options);
  const {width, containerRef, mounted} = useContainerWidth({measureBeforeMount: true});
  const viewportHeight = useSyncExternalStore(subscribeToResize, getViewportHeight);
  const rowHeight = computeRowHeight(numRows, viewportHeight);

  useEffect(() => {
    pluginManager.loadAll().finally(() => setPluginsLoading(false));
  }, []);

  const actualNumRows =  useMemo(() => {
    return layout.reduce((max, item) => Math.max(max, item.y + item.h), 1);
  }, [layout])

  const placeholders = useMemo(() => {
    return computePlaceholders(layout, Math.max(actualNumRows, numRows), numColumns)
  }, [layout, actualNumRows, numRows, numColumns]);

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
        <button onClick={() => setSettingsOpen(true)}>Settings</button>
      </header>

      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <div className="dashboard-grid-wrapper" ref={containerRef as React.RefObject<HTMLDivElement>}>
        {pluginsLoading && (
          <div className="dashboard-loading-overlay">
            <span className="dashboard-loading-spinner" />
            <span>Loading plugins...</span>
          </div>
        )}
        {mounted && (
          <div className="dashboard-grid-container">
            <GridLayout
              className="dashboard-grid"
              width={width}
              layout={layout}
              gridConfig={{cols: numColumns, rowHeight, margin: MARGIN}}
              compactor={{...noCompactor, allowOverlap: false, preventCollision: true}}
              dragConfig={{handle: ".dashboard-panel-header"}}
              onDragStop={(current) => syncLayout(current)}
              onResizeStop={(current) => syncLayout(current)}
            >
              {layout.map(item => (
                <DashboardPanel
                  key={item.i}
                  title={item.i}
                  onClose={() => layoutApi.removeBox(item.i)}
                />
              ))}
            </GridLayout>

            {placeholders.map(p => (
              <div
                key={p.i}
                className="add-box-placeholder"
                style={toPixelStyle(p, width, numColumns, rowHeight)}
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
