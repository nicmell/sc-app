import {logger} from "@/lib/logger";
import "./LogOutputPanel.scss";

export function LogOutputPanel() {
  const entries = logger.useStore((s) => s.entries);

  return (
    <>
      <div className="log-header">
        <button onClick={() => logger.clear()}>Clear</button>
      </div>
      <div className="log-output">
        {entries.map((entry, i) => (
          <div key={i} className="log-entry">
            {entry}
          </div>
        ))}
      </div>
    </>
  );
}
