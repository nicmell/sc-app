import {ThemeProvider} from "@/components/ThemeProvider";
import {Dashboard} from "@/components/Dashboard";
import {ConnectScreen} from "@/components/ConnectScreen";
import {useRootStore} from "@/lib/stores/store";
import {isConnected} from "@/lib/stores/scsynth";

function App() {
  const connected = useRootStore(isConnected);

  return (
    <ThemeProvider>
      <main>
        {connected ? <Dashboard /> : <ConnectScreen />}
      </main>
    </ThemeProvider>
  );
}

export default App;
