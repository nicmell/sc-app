import {ThemeProvider} from "@/components/ThemeProvider";
import {Dashboard} from "@/components/Dashboard";
import {ConnectScreen} from "@/components/ConnectScreen";
import {useRootStore} from "@/lib/stores/rootStore.ts";
import {selectIsConnected} from "@/lib/stores/scsynth";

function App() {
  const connected = useRootStore(selectIsConnected);

  return (
    <ThemeProvider>
      <main>
        {connected ? <Dashboard /> : <ConnectScreen />}
      </main>
    </ThemeProvider>
  );
}

export default App;
