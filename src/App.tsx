import {ThemeProvider} from "@/components/ThemeProvider";
import {Dashboard} from "@/components/Dashboard";
import {ConnectScreen} from "@/components/ConnectScreen";
import {useAppStore} from "@/lib/stores/appStore";
import {ConnectionStatus} from "@/lib/constants";

function App() {
  const connected = useAppStore((s) => s.scsynth.connectionStatus === ConnectionStatus.CONNECTED);

  return (
    <ThemeProvider>
      <main>
        {connected ? <Dashboard /> : <ConnectScreen />}
      </main>
    </ThemeProvider>
  );
}

export default App;
