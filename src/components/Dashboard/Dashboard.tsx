import {ResponsiveGridLayout, useContainerWidth} from "react-grid-layout";
import type {Layout} from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import {useOsc} from "@/components/OscProvider";
import {useLayoutStore} from "@/lib/stores/layoutStore";
import {DashboardPanel} from "@/components/panels/DashboardPanel";
import {ServerControlsPanel} from "@/components/panels/ServerControlsPanel";
import {SynthControlsPanel} from "@/components/panels/SynthControlsPanel";
import {LogOutputPanel} from "@/components/panels/LogOutputPanel";
import "./Dashboard.scss";

const PANEL_MAP: Record<string, {title: string; component: React.FC}> = {
  server: {title: "Server", component: ServerControlsPanel},
  synth: {title: "Synth", component: SynthControlsPanel},
  log: {title: "Log", component: LogOutputPanel},
};

export function Dashboard({address}: {address: string}) {
  const {disconnect} = useOsc();
  const {layout, setLayout, resetLayout} = useLayoutStore();
  const {width, containerRef, mounted} = useContainerWidth({measureBeforeMount: true});

  return (
    <div className="dashboard">
      <header className="header">
        <h1>SC-App</h1>
        <button onClick={resetLayout}>Reset Layout</button>
        <button onClick={disconnect}>Disconnect</button>
      </header>

      <div className="dashboard-grid-wrapper" ref={containerRef as React.RefObject<HTMLDivElement>}>
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

      <footer className="footer">
        <span className="connected-address">{address}</span>
      </footer>
    </div>
  );
}
