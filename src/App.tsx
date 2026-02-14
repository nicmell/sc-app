import {ThemeProvider} from "@/components/ThemeProvider";
import {Dashboard} from "@/components/Dashboard";
import {ConnectScreen} from "@/components/ConnectScreen";
import {useSelector} from "@/lib/stores/store";
import scsynth from "@/lib/stores/scsynth";

function App() {
  const connected = useSelector(scsynth.selectors.isConnected);

  return (
    <ThemeProvider>
      <main>
        {connected ? <Dashboard /> : <ConnectScreen />}
      </main>
    </ThemeProvider>
  );
}

export default App;
