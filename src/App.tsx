import {useCallback, useEffect, useRef, useState} from "react";
import OSC from "osc-js";
import {TauriUdpPlugin} from "./osc/TauriUdpPlugin";
import {
  createDefRecvMessage,
  createDumpOscMessage,
  createFreeNodeMessage, createNotifyMessage,
  createQuitMessage,
  createStatusMessage,
  createSynthMessage,
  createVersionMessage,
  formatOscReply,
} from "./osc/oscService";
import "./App.css";


function createOSC() {
  return new OSC({plugin: new TauriUdpPlugin()});
}

function parseAddress(addr: string): { host: string; port: number } {
  const [host, portStr] = addr.split(":");
  return { host, port: parseInt(portStr, 10) };
}

function App() {
  const [address, setAddress] = useState("127.0.0.1:57110");
  const [connected, setConnected] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [nextNodeId, setNextNodeId] = useState(1000);
  const osc = useRef(createOSC()).current;

  const connecting = osc.status() === OSC.STATUS.IS_CONNECTING;

  const appendLog = useCallback((msg: string) => {
    setLog((prev) => [
      ...prev.slice(-49),
      `[${new Date().toLocaleTimeString()}] ${msg}`,
    ]);
  }, []);

  useEffect(() => {
    const onMessageId = osc.on("*", (msg: InstanceType<typeof OSC.Message>) => {
      const reply = {address: msg.address, args: msg.args as unknown[]};
      appendLog(formatOscReply(reply));
    });
    const onOpenId = osc.on("open", () => {
      setConnected(true);
      appendLog("Connected.");
    });
    const onCloseId = osc.on("close", () => {
      setConnected(false);
      appendLog("Disconnected.");
    });
    const onErrorId = osc.on("error", (err: unknown) => {
      appendLog(`Error: ${err}`);
    });

    return () => {
      osc.off("*", onMessageId);
      osc.off("open", onOpenId);
      osc.off("close", onCloseId);
      osc.off("error", onErrorId);
    };
  }, []);

  useEffect(() => {
    if (osc.status() !== OSC.STATUS.IS_OPEN) return;
    (async () => {
      if (connected) {
        osc.send(createNotifyMessage(1));
        osc.send(await createDefRecvMessage());
      }
    })();
  }, [connected]);


  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    await osc.open(parseAddress(address));
  };

  const handleDisconnect = async () => {
    await osc.close();
  };

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
