import {ThemeProvider} from "@/components/ThemeProvider";
import {Dashboard} from "@/components/Dashboard";
import {ConnectScreen} from "@/components/ConnectScreen";
import {useScsynthStore} from "@/lib/stores/scsynthStore";
import {ConnectionStatus} from "@/lib/constants";

function App() {
  const connected = useScsynthStore((s) => s.connectionStatus === ConnectionStatus.CONNECTED);

  return (
    <ThemeProvider>
      <main>
        {connected ? <Dashboard /> : <ConnectScreen />}
      </main>
    </ThemeProvider>
  );
}

export default App;
