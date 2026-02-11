import {useState} from "react";
import {OscProvider, useOsc} from "@/components/OscProvider";
import {ThemeProvider} from "@/components/ThemeProvider";
import {Dashboard} from "@/components/Dashboard";
import {ConnectScreen} from "@/components/ConnectScreen";

function AppContent() {
  const [address, setAddress] = useState("");
  const {connected} = useOsc();

  return (
    <main>
      {connected ? (
        <Dashboard address={address} />
      ) : (
        <ConnectScreen onConnected={setAddress} />
      )}
    </main>
  );
}

function App() {
  return (
    <OscProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </OscProvider>
  );
}

export default App;
