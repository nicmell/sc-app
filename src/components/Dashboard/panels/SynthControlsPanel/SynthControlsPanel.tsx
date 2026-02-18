import {useEffect, useRef, useState} from "react";
import {oscService} from "@/lib/osc";
import {logger} from "@/lib/logger";
import {
  freeNodeMessage,
  nodeRunMessage,
  newSynthMessage,
} from "@/lib/osc/messages.ts";
import {NodeValueRange} from "@/components/NodeValueRange";
import "./SynthControlsPanel.scss";

export function SynthControlsPanel() {
  const [nodeId,] = useState(oscService.nextNodeId());
  const [playing, setPlaying] = useState(false);
  const playingRef = useRef(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      oscService.send(
          newSynthMessage("sine", nodeId),
          nodeRunMessage(-1, 0)
      );
      logger.log(`Created synth "sine" nodeId=${nodeId}`);
    }
    mountedRef.current = true;
    return () => {
      if (mountedRef.current) {
        mountedRef.current = false;
        oscService.send(freeNodeMessage(nodeId));
      }
    };
  }, [nodeId]);

  const handleTogglePlay = () => {
    try {
      if (playingRef.current) {
        oscService.send(nodeRunMessage(nodeId, 0));
        logger.log(`Sent /n_run nodeId=${nodeId} 0`);
        playingRef.current = false;
        setPlaying(false);
      } else {
        oscService.send(nodeRunMessage(nodeId, 1));
        logger.log(`Sent /n_run nodeId=${nodeId} 1`);
        playingRef.current = true;
        setPlaying(true);
      }
    } catch (e) {
      logger.log(`Send failed: ${e}`);
    }
  };

  return (
    <>
      <div className="controls">
        <button onClick={handleTogglePlay}>{playing ? "Stop" : "Play"}</button>
      </div>
      <NodeValueRange nodeId={nodeId} paramKey="freq" label="Freq" min={20} max={2000} step={1} defaultValue={440} format="%d Hz" />
      <NodeValueRange nodeId={nodeId} paramKey="amp" label="Amp" min={0} max={1} step={0.01} defaultValue={0.2} format="%.2f" />
    </>
  );
}
