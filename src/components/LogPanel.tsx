import {useEffect, useRef, useState} from "react";
import {useOsc} from "./OscProvider";
import {
  createDumpOscMessage,
  createFreeNodeMessage,
  createNodeRunMessage,
  createQuitMessage,
  createStatusMessage,
  createVersionMessage,
  createSynthMessage,
} from "../osc/oscService";
import {NodeValueRange} from "./NodeValueRange";

const NODE_ID = 1000;

export function LogPanel({address}: { address: string }) {
  const {osc, disconnect, appendLog, log, clearLog} = useOsc();
  const [playing, setPlaying] = useState(false);
  const playingRef = useRef(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      osc.send(createSynthMessage("sine", NODE_ID));
      osc.send(createNodeRunMessage(NODE_ID, 0));
      appendLog(`Created synth "sine" nodeId=${NODE_ID}`);
    }
    mountedRef.current = true;
    return () => {
      if (mountedRef.current) {
        mountedRef.current = false;
        osc.send(createFreeNodeMessage(NODE_ID));
      }
    };
  }, []);

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

  const handleTogglePlay = () => {
    try {
      if (playingRef.current) {
        osc.send(createNodeRunMessage(NODE_ID, 0));
        appendLog(`Sent /n_run nodeId=${NODE_ID} 0`);
        playingRef.current = false;
        setPlaying(false);
      } else {
        osc.send(createNodeRunMessage(NODE_ID, 1));
        appendLog(`Sent /n_run nodeId=${NODE_ID} 1`);
        playingRef.current = true;
        setPlaying(true);
      }
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
          <button onClick={handleTogglePlay}>{playing ? "Stop" : "Play"}</button>
        </div>
        <NodeValueRange nodeId={NODE_ID} paramKey="freq" label="Freq" min={20} max={2000} step={1} defaultValue={440} format="%d Hz"/>
        <NodeValueRange nodeId={NODE_ID} paramKey="amp" label="Amp" min={0} max={1} step={0.01} defaultValue={0.2} format="%.2f"/>
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
