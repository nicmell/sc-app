import {oscService} from "@/lib/osc";
import {logger} from "@/lib/logger";
import {
  dumpOscMessage,
  quitMessage,
  statusMessage,
  versionMessage,
} from "@/lib/osc/messages.ts";
import "./ServerControlsPanel.scss";

export function ServerControlsPanel() {
  const handleSendStatus = () => {
    try {
      oscService.send(statusMessage());
    } catch (e) {
      logger.log(`/status failed: ${e}`);
    }
  };

  const handleVersion = () => {
    try {
      oscService.send(versionMessage());
    } catch (e) {
      logger.log(`/version failed: ${e}`);
    }
  };

  const handleDumpOsc = () => {
    try {
      oscService.send(dumpOscMessage(1));
      logger.log("Sent /dumpOSC 1");
    } catch (e) {
      logger.log(`Send failed: ${e}`);
    }
  };

  const handleQuit = () => {
    try {
      oscService.send(quitMessage());
      logger.log("Sent /quit — server shutting down");
    } catch (e) {
      logger.log(`Send failed: ${e}`);
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
