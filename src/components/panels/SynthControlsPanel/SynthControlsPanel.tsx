import {useEffect, useRef, useState} from "react";
import {useOsc} from "@/components/OscProvider";
import {oscService} from "@/lib/osc";
import {
  createFreeNodeMessage,
  createNodeRunMessage,
  createSynthMessage,
} from "@/lib/osc/messages";
import {NodeValueRange} from "@/components/NodeValueRange";
import "./SynthControlsPanel.scss";

const NODE_ID = 1000;

export function SynthControlsPanel() {
  const {appendLog} = useOsc();
  const [playing, setPlaying] = useState(false);
  const playingRef = useRef(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      oscService.send(createSynthMessage("sine", NODE_ID));
      oscService.send(createNodeRunMessage(NODE_ID, 0));
      appendLog(`Created synth "sine" nodeId=${NODE_ID}`);
    }
    mountedRef.current = true;
    return () => {
      if (mountedRef.current) {
        mountedRef.current = false;
        oscService.send(createFreeNodeMessage(NODE_ID));
      }
    };
  }, []);

  const handleTogglePlay = () => {
    try {
      if (playingRef.current) {
        oscService.send(createNodeRunMessage(NODE_ID, 0));
        appendLog(`Sent /n_run nodeId=${NODE_ID} 0`);
        playingRef.current = false;
        setPlaying(false);
      } else {
        oscService.send(createNodeRunMessage(NODE_ID, 1));
        appendLog(`Sent /n_run nodeId=${NODE_ID} 1`);
        playingRef.current = true;
        setPlaying(true);
      }
    } catch (e) {
      appendLog(`Send failed: ${e}`);
    }
  };

  return (
    <>
      <div className="controls">
        <button onClick={handleTogglePlay}>{playing ? "Stop" : "Play"}</button>
      </div>
      <NodeValueRange nodeId={NODE_ID} paramKey="freq" label="Freq" min={20} max={2000} step={1} defaultValue={440} format="%d Hz" />
      <NodeValueRange nodeId={NODE_ID} paramKey="amp" label="Amp" min={0} max={1} step={0.01} defaultValue={0.2} format="%.2f" />
    </>
  );
}
