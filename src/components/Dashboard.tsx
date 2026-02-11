import {ResponsiveGridLayout, useContainerWidth} from "react-grid-layout";
import type {Layout} from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import {useOsc} from "./OscProvider";
import {useLayoutStore} from "../stores/layoutStore";
import {DashboardPanel} from "./panels/DashboardPanel";
import {ServerControlsPanel} from "./panels/ServerControlsPanel";
import {SynthControlsPanel} from "./panels/SynthControlsPanel";
import {LogOutputPanel} from "./panels/LogOutputPanel";

const PANEL_MAP: Record<string, {title: string; component: React.FC}> = {
  server: {title: "Server", component: ServerControlsPanel},
  synth: {title: "Synth", component: SynthControlsPanel},
  log: {title: "Log", component: LogOutputPanel},
};

export function Dashboard({address}: {address: string}) {
  const {disconnect} = useOsc();
  const {layout, setLayout, resetLayout} = useLayoutStore();
  const {width, containerRef, mounted} = useContainerWidth();

  return (
    <div className="dashboard" ref={containerRef as React.RefObject<HTMLDivElement>}>
      <header className="top-bar">
        <h1>SC-App</h1>
        <span className="connected-address">{address}</span>
        <button onClick={resetLayout}>Reset Layout</button>
        <button onClick={disconnect}>Disconnect</button>
      </header>

      {mounted && (
        <ResponsiveGridLayout
          className="dashboard-grid"
          width={width}
          layouts={{lg: layout}}
          breakpoints={{lg: 996, md: 768, sm: 480, xs: 0}}
          cols={{lg: 12, md: 12, sm: 6, xs: 1}}
          rowHeight={60}
          dragConfig={{handle: ".dashboard-panel-header"}}
          onLayoutChange={(current: Layout) => setLayout([...current])}
        >
          {layout.map((item) => {
            const panel = PANEL_MAP[item.i];
            if (!panel) return null;
            const PanelComponent = panel.component;
            return (
              <DashboardPanel key={item.i} title={panel.title}>
                <PanelComponent />
              </DashboardPanel>
            );
          })}
        </ResponsiveGridLayout>
      )}
    </div>
  );
}
