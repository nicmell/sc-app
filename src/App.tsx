import {useState} from "react";
import {OscProvider, useOsc} from "./components/OscProvider";
import {LogPanel} from "./components/LogPanel";
import "./App.css";

function AppContent() {
  const [address, setAddress] = useState("127.0.0.1:57110");
  const {connected, connecting, connect} = useOsc();

  if (!connected) {
    return (
      <main className="container connect-screen">
        <h1>SC-App</h1>
        <form onSubmit={(e) => { e.preventDefault(); connect(address); }}>
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

  return <LogPanel address={address} />;
}

function App() {
  return (
    <OscProvider>
      <AppContent />
    </OscProvider>
  );
}

export default App;
