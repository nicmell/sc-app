import {useState} from "react";
import {oscService} from "@/lib/osc";
import {useRootStore} from "@/lib/stores/store";
import scsynth from "@/lib/stores/scsynth";
import {ADDRESS_REGEXP} from "@/constants/osc";
import "./ConnectScreen.scss";

function parseAddress(addr: string): { host: string; port: number } {
  const match = ADDRESS_REGEXP.exec(addr);
  if (!match) throw new Error(`Invalid address: ${addr}`);
  return { host: match[1], port: parseInt(match[2], 10) };
}

export function ConnectScreen() {
  const defaultAddress = useRootStore(scsynth.selectors.address);
  const connecting = useRootStore(scsynth.selectors.isConnecting);
  const [address, setAddress] = useState(defaultAddress);

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
