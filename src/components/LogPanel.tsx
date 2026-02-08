import {useEffect, useRef, useState} from "react";
import {useOsc} from "./OscProvider";
import {
  createDumpOscMessage,
  createFreeNodeMessage,
  createNodeSetMessage,
  createQuitMessage,
  createStatusMessage,
  createSynthMessage,
  createDefRecvMessage,
  createVersionMessage,
} from "../osc/oscService";

const NODE_ID = 1000;

export function LogPanel({address}: { address: string }) {
  const {osc, disconnect, appendLog, log, clearLog} = useOsc();
  const [playing, setPlaying] = useState(false);
  const [freq, setFreq] = useState(440);
  const [amp, setAmp] = useState(0.2);
  const playingRef = useRef(false);

  useEffect(() => {
    createDefRecvMessage().then((msg) => osc.send(msg));
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
        osc.send(createFreeNodeMessage(NODE_ID));
        appendLog(`Sent /n_free nodeId=${NODE_ID}`);
        playingRef.current = false;
        setPlaying(false);
      } else {
        osc.send(createSynthMessage("sine", NODE_ID, 0, 0, {freq, amp}));
        appendLog(`Sent /s_new "sine" nodeId=${NODE_ID} freq=${freq} amp=${amp}`);
        playingRef.current = true;
        setPlaying(true);
      }
    } catch (e) {
      appendLog(`Send failed: ${e}`);
    }
  };

  const handleFreqChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setFreq(val);
    if (playingRef.current) {
      osc.send(createNodeSetMessage(NODE_ID, {freq: val}));
    }
  };

  const handleAmpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setAmp(val);
    if (playingRef.current) {
      osc.send(createNodeSetMessage(NODE_ID, {amp: val}));
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
        <div className="range-control">
          <label>
            <span>Freq: {freq} Hz</span>
            <input type="range" min={20} max={2000} step={1} value={freq} onChange={handleFreqChange} />
          </label>
        </div>
        <div className="range-control">
          <label>
            <span>Amp: {amp.toFixed(2)}</span>
            <input type="range" min={0} max={1} step={0.01} value={amp} onChange={handleAmpChange} />
          </label>
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
