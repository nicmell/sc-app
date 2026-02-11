import {createContext, useCallback, useContext, useEffect, useState, type ReactNode} from "react";
import OSC from "osc-js";
import {oscService} from "../osc";
import {createNotifyMessage} from "../osc/messages";

interface OscReply {
  address: string;
  args: unknown[];
}

function formatStatusReply(args: unknown[]): string {
  const [, ugens, synths, groups, defs, avgCpu, peakCpu, , actSR] = args as number[];
  return (
    `UGens: ${ugens} | Synths: ${synths} | Groups: ${groups} | Defs: ${defs} | ` +
    `CPU: ${avgCpu.toFixed(1)}% avg / ${peakCpu.toFixed(1)}% peak | ` +
    `SR: ${actSR.toFixed(0)} Hz`
  );
}

function formatVersionReply(args: unknown[]): string {
  const [name, major, minor, patch, branch, hash] = args as (string | number)[];
  return `${name} ${major}.${minor}.${patch} (${branch} ${hash})`;
}

function formatOscReply(reply: OscReply): string {
  switch (reply.address) {
    case '/status.reply':
      return formatStatusReply(reply.args);
    case '/version.reply':
      return formatVersionReply(reply.args);
    default:
      return `${reply.address} ${reply.args.join(' ')}`;
  }
}

interface OscContextValue {
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
  const [connected, setConnected] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const connecting = oscService.status === OSC.STATUS.IS_CONNECTING;

  const appendLog = useCallback((msg: string) => {
    setLog((prev) => [
      ...prev.slice(-49),
      `[${new Date().toLocaleTimeString()}] ${msg}`,
    ]);
  }, []);

  const clearLog = useCallback(() => setLog([]), []);

  const handleMessage = useCallback((...args: unknown[]) => {
    const msg = args[0] as InstanceType<typeof OSC.Message>;
    const reply: OscReply = {address: msg.address, args: msg.args as unknown[]};
    appendLog(formatOscReply(reply));
  }, [appendLog]);

  const handleOpen = useCallback(() => {
    setConnected(true);
    oscService.send(createNotifyMessage(1));
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
    const onMessageId = oscService.on("*", handleMessage);
    const onOpenId = oscService.on("open", handleOpen);
    const onCloseId = oscService.on("close", handleClose);
    const onErrorId = oscService.on("error", handleError);

    return () => {
      oscService.off("*", onMessageId);
      oscService.off("open", onOpenId);
      oscService.off("close", onCloseId);
      oscService.off("error", onErrorId);
    };
  }, [handleMessage, handleOpen, handleClose, handleError]);

  const connect = useCallback(async (address: string) => {
    await oscService.open(address);
    oscService.send(createNotifyMessage(0));
  }, []);

  const disconnect = useCallback(async () => {
    oscService.send(createNotifyMessage(1));
    await oscService.close();
  }, []);

  return (
    <OscContext.Provider value={{connected, connecting, log, connect, disconnect, appendLog, clearLog}}>
      {children}
    </OscContext.Provider>
  );
}
