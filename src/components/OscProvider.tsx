import {createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode} from "react";
import OSC from "osc-js";
import {TauriUdpPlugin} from "../osc/TauriUdpPlugin";
import {createDefRecvMessage, createNotifyMessage, formatOscReply, type OscReply} from "../osc/oscService";

function createOSC() {
  return new OSC({plugin: new TauriUdpPlugin()});
}

function parseAddress(addr: string): { host: string; port: number } {
  const [host, portStr] = addr.split(":");
  return {host, port: parseInt(portStr, 10)};
}

interface OscContextValue {
  osc: InstanceType<typeof OSC>;
  connected: boolean;
  connecting: boolean;
  log: string[];
  connect: (address: string) => Promise<void>;
  disconnect: () => Promise<void>;
  appendLog: (msg: string) => void;
  clearLog: () => void;
}

const OscContext = createContext<OscContextValue | null>(null);

export function useOsc(): OscContextValue {
  const ctx = useContext(OscContext);
  if (!ctx) throw new Error("useOsc must be used within <OscProvider>");
  return ctx;
}

export function OscProvider({children}: { children: ReactNode }) {
  const osc = useRef(createOSC()).current;
  const [connected, setConnected] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const connecting = osc.status() === OSC.STATUS.IS_CONNECTING;

  const appendLog = useCallback((msg: string) => {
    setLog((prev) => [
      ...prev.slice(-49),
      `[${new Date().toLocaleTimeString()}] ${msg}`,
    ]);
  }, []);

  const clearLog = useCallback(() => setLog([]), []);

  const handleMessage = useCallback((msg: InstanceType<typeof OSC.Message>) => {
    const reply: OscReply = {address: msg.address, args: msg.args as unknown[]};
    appendLog(formatOscReply(reply));
  }, [appendLog]);

  const handleOpen = useCallback(() => {
    setConnected(true);
    appendLog("Connected.");
  }, [appendLog]);

  const handleClose = useCallback(() => {
    setConnected(false);
    appendLog("Disconnected.");
  }, [appendLog]);

  const handleError = useCallback((err: unknown) => {
    appendLog(`Error: ${err}`);
  }, [appendLog]);

  useEffect(() => {
    const onMessageId = osc.on("*", handleMessage);
    const onOpenId = osc.on("open", handleOpen);
    const onCloseId = osc.on("close", handleClose);
    const onErrorId = osc.on("error", handleError);

    return () => {
      osc.off("*", onMessageId);
      osc.off("open", onOpenId);
      osc.off("close", onCloseId);
      osc.off("error", onErrorId);
    };
  }, [handleMessage, handleOpen, handleClose, handleError]);

  useEffect(() => {
    if (osc.status() !== OSC.STATUS.IS_OPEN) return;
    (async () => {
      if (connected) {
        osc.send(createNotifyMessage(1));
        osc.send(await createDefRecvMessage());
      }
    })();
  }, [connected]);

  const connect = useCallback(async (address: string) => {
    await osc.open(parseAddress(address));
  }, []);

  const disconnect = useCallback(async () => {
    await osc.close();
  }, []);

  return (
    <OscContext.Provider value={{osc, connected, connecting, log, connect, disconnect, appendLog, clearLog}}>
      {children}
    </OscContext.Provider>
  );
}
