import {ThemeProvider} from "@/components/ThemeProvider";
import {Dashboard} from "@/components/Dashboard";
import {ConnectScreen} from "@/components/ConnectScreen";
import {useSelector} from "@/lib/stores/store";
import root from "@/lib/stores/root";

function App() {
  const connected = useSelector(root.selectors.isConnected);

  return (
    <ThemeProvider>
      <main>
        {connected ? <Dashboard /> : <ConnectScreen />}
      </main>
    </ThemeProvider>
  );
}

export default App;
