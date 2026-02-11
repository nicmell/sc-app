import {useState} from "react";
import {useOsc} from "@/components/OscProvider";
import "./ConnectScreen.scss";

interface ConnectScreenProps {
  onConnected: (address: string) => void;
}

export function ConnectScreen({onConnected}: ConnectScreenProps) {
  const [address, setAddress] = useState("127.0.0.1:57110");
  const {connecting, connect} = useOsc();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await connect(address);
    onConnected(address);
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
        <button type="submit" disabled={connecting}>
          {connecting ? "Connecting..." : "Connect"}
        </button>
      </form>
    </div>
  );
}
