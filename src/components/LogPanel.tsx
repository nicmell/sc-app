import {useState} from "react";
import {useOsc} from "./OscProvider";
import {
  createDumpOscMessage,
  createFreeNodeMessage,
  createQuitMessage,
  createStatusMessage,
  createSynthMessage,
  createVersionMessage,
} from "../osc/oscService";

export function LogPanel({address}: { address: string }) {
  const {osc, disconnect, appendLog, log, clearLog} = useOsc();
  const [nextNodeId, setNextNodeId] = useState(1000);

  const handleSendStatus = () => {
    try {
      osc.send(createStatusMessage());
    } catch (e) {
      appendLog(`/status failed: ${e}`);
    }
  };

  const handleDumpOsc = () => {
    try {
      osc.send(createDumpOscMessage(1));
      appendLog("Sent /dumpOSC 1");
    } catch (e) {
      appendLog(`Send failed: ${e}`);
    }
  };

  const handleVersion = () => {
    try {
      osc.send(createVersionMessage());
    } catch (e) {
      appendLog(`/version failed: ${e}`);
    }
  };

  const handleQuit = () => {
    try {
      osc.send(createQuitMessage());
      appendLog("Sent /quit — server shutting down");
    } catch (e) {
      appendLog(`Send failed: ${e}`);
    }
  };

  const handlePlayNote = () => {
    try {
      const nodeId = nextNodeId;
      const msg = createSynthMessage("sine", nodeId, 0, 0, {
        freq: 440,
        amp: 0.2,
      });
      osc.send(msg);
      setNextNodeId((prev) => prev + 1);
      appendLog(`Sent /s_new "sine" nodeId=${nodeId} freq=440 amp=0.2`);
    } catch (e) {
      appendLog(`Send failed: ${e}`);
    }
  };

  const handleFreeNode = () => {
    try {
      const nodeId = nextNodeId - 1;
      if (nodeId < 1000) return appendLog("No nodes to free.");
      osc.send(createFreeNodeMessage(nodeId));
      appendLog(`Sent /n_free nodeId=${nodeId}`);
    } catch (e) {
      appendLog(`Send failed: ${e}`);
    }
  };

  return (
    <main className="container">
      <header className="top-bar">
        <h1>SC-App</h1>
        <span className="connected-address">{address}</span>
        <button onClick={disconnect}>Disconnect</button>
      </header>

      <section>
        <h2>Server</h2>
        <div className="controls">
          <button onClick={handleSendStatus}>/status</button>
          <button onClick={handleVersion}>/version</button>
          <button onClick={handleDumpOsc}>/dumpOSC</button>
          <button onClick={handleQuit}>/quit</button>
        </div>
      </section>

      <section>
        <h2>Synth</h2>
        <div className="controls">
          <button onClick={handlePlayNote}>Play Note</button>
          <button onClick={handleFreeNode}>Free Last Node</button>
        </div>
      </section>

      <section>
        <div className="log-header">
          <h2>Log</h2>
          <button onClick={clearLog}>Clear</button>
        </div>
        <div className="log-output">
          {log.map((entry, i) => (
            <div key={i} className="log-entry">
              {entry}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
