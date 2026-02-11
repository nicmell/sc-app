import {useOsc} from "../OscProvider";

export function LogOutputPanel() {
  const {log, clearLog} = useOsc();

  return (
    <>
      <div className="log-header">
        <button onClick={clearLog}>Clear</button>
      </div>
      <div className="log-output">
        {log.map((entry, i) => (
          <div key={i} className="log-entry">
            {entry}
          </div>
        ))}
      </div>
    </>
  );
}
