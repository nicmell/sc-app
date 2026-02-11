import {useOsc} from "../../OscProvider";
import {oscService} from "../../../lib/osc";
import {
  createDumpOscMessage,
  createQuitMessage,
  createStatusMessage,
  createVersionMessage,
} from "../../../lib/osc/messages";
import "./ServerControlsPanel.scss";

export function ServerControlsPanel() {
  const {appendLog} = useOsc();

  const handleSendStatus = () => {
    try {
      oscService.send(createStatusMessage());
    } catch (e) {
      appendLog(`/status failed: ${e}`);
    }
  };

  const handleVersion = () => {
    try {
      oscService.send(createVersionMessage());
    } catch (e) {
      appendLog(`/version failed: ${e}`);
    }
  };

  const handleDumpOsc = () => {
    try {
      oscService.send(createDumpOscMessage(1));
      appendLog("Sent /dumpOSC 1");
    } catch (e) {
      appendLog(`Send failed: ${e}`);
    }
  };

  const handleQuit = () => {
    try {
      oscService.send(createQuitMessage());
      appendLog("Sent /quit — server shutting down");
    } catch (e) {
      appendLog(`Send failed: ${e}`);
    }
  };

  return (
    <div className="controls">
      <button onClick={handleSendStatus}>/status</button>
      <button onClick={handleVersion}>/version</button>
      <button onClick={handleDumpOsc}>/dumpOSC</button>
      <button onClick={handleQuit}>/quit</button>
    </div>
  );
}
