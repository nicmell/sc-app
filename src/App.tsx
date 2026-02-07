import { useState, useRef, useCallback } from "react";
import OSC from "osc-js";
import { TauriUdpPlugin } from "./osc/TauriUdpPlugin";
import {
  createStatusMessage,
  createSynthMessage,
  createFreeNodeMessage,
} from "./osc/oscService";
import "./App.css";

const STATUS_LABELS: Record<number, string> = {
  [-1]: "Not Initialized",
  0: "Connecting",
  1: "Open",
  2: "Closing",
  3: "Closed",
};

function App() {
  const [address, setAddress] = useState("127.0.0.1:57110");
  const [connectionStatus, setConnectionStatus] = useState(-1);
  const [log, setLog] = useState<string[]>([]);
  const [nextNodeId, setNextNodeId] = useState(1000);
  const oscRef = useRef<InstanceType<typeof OSC> | null>(null);

  const appendLog = useCallback((msg: string) => {
    setLog((prev) => [
      ...prev.slice(-49),
      `[${new Date().toLocaleTimeString()}] ${msg}`,
    ]);
  }, []);

  const handleConnect = async () => {
    try {
      if (oscRef.current) {
        await oscRef.current.close();
      }
      const plugin = new TauriUdpPlugin({ targetAddress: address });
      const osc = new OSC({ plugin });

      osc.on("open", () => {
        setConnectionStatus(1);
        appendLog(`Socket bound, target: ${address}`);
      });
      osc.on("close", () => {
        setConnectionStatus(3);
        appendLog("Disconnected.");
      });
      osc.on("error", (err: unknown) => {
        appendLog(`Error: ${err}`);
      });

      await osc.open();
      oscRef.current = osc;
    } catch (e) {
      appendLog(`Connection failed: ${e}`);
    }
  };

  const handleDisconnect = async () => {
    if (oscRef.current) {
      await oscRef.current.close();
      oscRef.current = null;
    }
  };

  const handleSendStatus = () => {
    if (!oscRef.current) return appendLog("Not connected.");
    try {
      oscRef.current.send(createStatusMessage());
      appendLog("Sent /status");
    } catch (e) {
      appendLog(`Send failed: ${e}`);
    }
  };

  const handlePlayNote = () => {
    if (!oscRef.current) return appendLog("Not connected.");
    try {
      const nodeId = nextNodeId;
      const msg = createSynthMessage("default", nodeId, 0, 0, {
        freq: 440,
        amp: 0.2,
      });
      oscRef.current.send(msg);
      setNextNodeId((prev) => prev + 1);
      appendLog(`Sent /s_new "default" nodeId=${nodeId} freq=440 amp=0.2`);
    } catch (e) {
      appendLog(`Send failed: ${e}`);
    }
  };

  const handleFreeNode = () => {
    if (!oscRef.current) return appendLog("Not connected.");
    try {
      const nodeId = nextNodeId - 1;
      if (nodeId < 1000) return appendLog("No nodes to free.");
      oscRef.current.send(createFreeNodeMessage(nodeId));
      appendLog(`Sent /n_free nodeId=${nodeId}`);
    } catch (e) {
      appendLog(`Send failed: ${e}`);
    }
  };

  const isOpen = connectionStatus === 1;

  return (
    <main className="container">
      <h1>SC-App</h1>

      <section>
        <label htmlFor="sc-address">scsynth address:</label>
        <div className="row">
          <input
            id="sc-address"
            value={address}
            onChange={(e) => setAddress(e.currentTarget.value)}
            placeholder="127.0.0.1:57110"
          />
          <button onClick={handleConnect} disabled={isOpen}>
            Connect
          </button>
          <button onClick={handleDisconnect} disabled={!isOpen}>
            Disconnect
          </button>
        </div>
        <p className="status">
          Status: <strong>{STATUS_LABELS[connectionStatus] ?? "Unknown"}</strong>
        </p>
      </section>

      <section>
        <h2>Controls</h2>
        <div className="controls">
          <button onClick={handleSendStatus} disabled={!isOpen}>
            Send /status
          </button>
          <button onClick={handlePlayNote} disabled={!isOpen}>
            Play Note
          </button>
          <button onClick={handleFreeNode} disabled={!isOpen}>
            Free Last Node
          </button>
        </div>
      </section>

      <section>
        <h2>Log</h2>
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

export default App;
