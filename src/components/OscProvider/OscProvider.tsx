import {createContext, useCallback, useContext, useEffect, useState, type ReactNode} from "react";
import OSC from "osc-js";
import {oscService} from "@/lib/osc";
import {createNotifyMessage} from "@/lib/osc/messages";

interface OscContextValue {
  connected: boolean;
  connecting: boolean;
  connect: (address: string) => Promise<void>;
  disconnect: () => Promise<void>;
}

const OscContext = createContext<OscContextValue | null>(null);

export function useOsc(): OscContextValue {
  const ctx = useContext(OscContext);
  if (!ctx) throw new Error("useOsc must be used within <OscProvider>");
  return ctx;
}

export function OscProvider({children}: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const connecting = oscService.status === OSC.STATUS.IS_CONNECTING;

  useEffect(() => {
    const onOpenId = oscService.on("open", () => {
      setConnected(true);
      oscService.send(createNotifyMessage(1));
    });
    const onCloseId = oscService.on("close", () => {
      setConnected(false);
    });

    return () => {
      oscService.off("open", onOpenId);
      oscService.off("close", onCloseId);
    };
  }, []);

  const connect = useCallback(async (address: string) => {
    await oscService.open(address);
    oscService.send(createNotifyMessage(0));
  }, []);

  const disconnect = useCallback(async () => {
    oscService.send(createNotifyMessage(1));
    await oscService.close();
  }, []);

  return (
    <OscContext.Provider value={{connected, connecting, connect, disconnect}}>
      {children}
    </OscContext.Provider>
  );
}
