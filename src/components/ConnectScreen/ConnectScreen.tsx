import {useState} from "react";
import {oscService} from "@/lib/osc";
import {useAppStore} from "@/lib/stores/appStore";
import {ConnectionStatus, ADDRESS_REGEXP} from "@/lib/constants";
import "./ConnectScreen.scss";

function parseAddress(addr: string): { host: string; port: number } {
  const match = ADDRESS_REGEXP.exec(addr);
  if (!match) throw new Error(`Invalid address: ${addr}`);
  return { host: match[1], port: parseInt(match[2], 10) };
}

export function ConnectScreen() {
  const options = useAppStore((s) => s.scsynth.options);
  const connecting = useAppStore((s) => s.scsynth.connectionStatus === ConnectionStatus.CONNECTING);
  const [address, setAddress] = useState(`${options.host}:${options.port}`);

  const valid = ADDRESS_REGEXP.test(address);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    oscService.setOptions(parseAddress(address));
    oscService.connect();
  };

  return (
    <div className="connect-screen">
      <h1>SC-App</h1>
      <form onSubmit={handleSubmit}>
        <label htmlFor="sc-address">scsynth address</label>
        <input
          id="sc-address"
          value={address}
          onChange={(e) => setAddress(e.currentTarget.value)}
          placeholder="127.0.0.1:57110"
          disabled={connecting}
        />
        <button type="submit" disabled={!valid || connecting}>
          {connecting ? "Connecting..." : "Connect"}
        </button>
      </form>
    </div>
  );
}
