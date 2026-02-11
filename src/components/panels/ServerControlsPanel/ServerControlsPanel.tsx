import {oscService} from "@/lib/osc";
import {logger} from "@/lib/logger";
import {
  createDumpOscMessage,
  createQuitMessage,
  createStatusMessage,
  createVersionMessage,
} from "@/lib/osc/messages";
import "./ServerControlsPanel.scss";

export function ServerControlsPanel() {
  const handleSendStatus = () => {
    try {
      oscService.send(createStatusMessage());
    } catch (e) {
      logger.log(`/status failed: ${e}`);
    }
  };

  const handleVersion = () => {
    try {
      oscService.send(createVersionMessage());
    } catch (e) {
      logger.log(`/version failed: ${e}`);
    }
  };

  const handleDumpOsc = () => {
    try {
      oscService.send(createDumpOscMessage(1));
      logger.log("Sent /dumpOSC 1");
    } catch (e) {
      logger.log(`Send failed: ${e}`);
    }
  };

  const handleQuit = () => {
    try {
      oscService.send(createQuitMessage());
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
