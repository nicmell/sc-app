import { useState, useRef, useCallback } from "react";
import OSC from "osc-js";
import { TauriUdpPlugin } from "./osc/TauriUdpPlugin";
import {
  createStatusMessage,
  createDumpOscMessage,
  createNotifyMessage,
  createQuitMessage,
  createVersionMessage,
  createDefRecvMessage,
  createSynthMessage,
  createFreeNodeMessage,
  formatOscReply,
  parseOscResponse,
} from "./osc/oscService";
import "./App.css";

function parseAddress(addr: string): { host: string; port: number } {
  const [host, portStr] = addr.split(":");
  return { host, port: parseInt(portStr, 10) };
}

function App() {
  const [address, setAddress] = useState("127.0.0.1:57110");
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [nextNodeId, setNextNodeId] = useState(1000);
  const oscRef = useRef<InstanceType<typeof OSC> | null>(null);

  const appendLog = useCallback((msg: string) => {
    setLog((prev) => [
      ...prev.slice(-49),
      `[${new Date().toLocaleTimeString()}] ${msg}`,
    ]);
  }, []);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setConnectError(null);
    setConnecting(true);
    try {
      if (oscRef.current) {
        await oscRef.current.close();
      }

      const { host, port } = parseAddress(address);
      const plugin = new TauriUdpPlugin({ send: { host, port } });
      const osc = new OSC({ plugin });

      osc.on("*", (msg: InstanceType<typeof OSC.Message>) => {
        const reply = { address: msg.address, args: msg.args as unknown[] };
        appendLog(formatOscReply(reply));
      });
      osc.on("close", () => {
        setConnected(false);
        appendLog("Disconnected.");
      });
      osc.on("error", (err: unknown) => {
        appendLog(`Error: ${err}`);
      });

      await osc.open();

      // Register with scsynth via /notify and wait for /done reply
      osc.send(createNotifyMessage(1));
      let notifyData: Uint8Array;
      try {
        notifyData = await plugin.waitForReply(2000);
      } catch {
        await osc.close();
        throw new Error("scsynth is not responding — is the server running?");
      }

      oscRef.current = osc;
      setConnected(true);

      const notifyReply = parseOscResponse(notifyData);
      const clientId = notifyReply.args[1];
      appendLog(`Connected to ${address} (clientID: ${clientId})`);

      // Fetch initial server status
      osc.send(createStatusMessage());

      // Auto-load SynthDef
      const msg = await createDefRecvMessage();
      osc.send(msg);
      appendLog('Sent /d_recv (SynthDef "sine": freq, amp)');
    } catch (e) {
      setConnectError(e instanceof Error ? e.message : `${e}`);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (oscRef.current) {
      try {
        oscRef.current.send(createNotifyMessage(0));
      } catch { /* server may already be gone */ }
      await oscRef.current.close();
      oscRef.current = null;
    }
  };

  const handleSendStatus = () => {
    if (!oscRef.current) return;
    try {
      oscRef.current.send(createStatusMessage());
    } catch (e) {
      appendLog(`/status failed: ${e}`);
    }
  };

  const handleDumpOsc = () => {
    if (!oscRef.current) return;
    try {
      oscRef.current.send(createDumpOscMessage(1));
      appendLog("Sent /dumpOSC 1");
    } catch (e) {
      appendLog(`Send failed: ${e}`);
    }
  };

  const handleVersion = () => {
    if (!oscRef.current) return;
    try {
      oscRef.current.send(createVersionMessage());
    } catch (e) {
      appendLog(`/version failed: ${e}`);
    }
  };

  const handleQuit = () => {
    if (!oscRef.current) return;
    try {
      oscRef.current.send(createQuitMessage());
      appendLog("Sent /quit — server shutting down");
    } catch (e) {
      appendLog(`Send failed: ${e}`);
    }
  };

  const handlePlayNote = () => {
    if (!oscRef.current) return;
    try {
      const nodeId = nextNodeId;
      const msg = createSynthMessage("sine", nodeId, 0, 0, {
        freq: 440,
        amp: 0.2,
      });
      oscRef.current.send(msg);
      setNextNodeId((prev) => prev + 1);
      appendLog(`Sent /s_new "sine" nodeId=${nodeId} freq=440 amp=0.2`);
    } catch (e) {
      appendLog(`Send failed: ${e}`);
    }
  };

  const handleFreeNode = () => {
    if (!oscRef.current) return;
    try {
      const nodeId = nextNodeId - 1;
      if (nodeId < 1000) return appendLog("No nodes to free.");
      oscRef.current.send(createFreeNodeMessage(nodeId));
      appendLog(`Sent /n_free nodeId=${nodeId}`);
    } catch (e) {
      appendLog(`Send failed: ${e}`);
    }
  };

  if (!connected) {
    return (
      <main className="container connect-screen">
        <h1>SC-App</h1>
        <form onSubmit={handleConnect}>
          <label htmlFor="sc-address">scsynth address</label>
          <input
            id="sc-address"
            value={address}
            onChange={(e) => setAddress(e.currentTarget.value)}
            placeholder="127.0.0.1:57110"
            disabled={connecting}
          />
          <button type="submit" disabled={connecting}>
            {connecting ? "Connecting..." : "Connect"}
          </button>
          {connectError && <p className="error">{connectError}</p>}
        </form>
      </main>
    );
  }

  return (
    <main className="container">
      <header className="top-bar">
        <h1>SC-App</h1>
        <span className="connected-address">{address}</span>
        <button onClick={handleDisconnect}>Disconnect</button>
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
          <button onClick={() => setLog([])}>Clear</button>
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

export default App;
