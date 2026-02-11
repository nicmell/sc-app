import {useEffect} from "react";
import OSC from "osc-js";
import {oscService} from "@/lib/osc";
import {logger} from "@/lib/logger";
import "./LogOutputPanel.scss";

interface OscReply {
  address: string;
  args: unknown[];
}

function formatStatusReply(args: unknown[]): string {
  const [, ugens, synths, groups, defs, avgCpu, peakCpu, , actSR] = args as number[];
  return (
    `UGens: ${ugens} | Synths: ${synths} | Groups: ${groups} | Defs: ${defs} | ` +
    `CPU: ${avgCpu.toFixed(1)}% avg / ${peakCpu.toFixed(1)}% peak | ` +
    `SR: ${actSR.toFixed(0)} Hz`
  );
}

function formatVersionReply(args: unknown[]): string {
  const [name, major, minor, patch, branch, hash] = args as (string | number)[];
  return `${name} ${major}.${minor}.${patch} (${branch} ${hash})`;
}

function formatOscReply(reply: OscReply): string {
  switch (reply.address) {
    case '/status.reply':
      return formatStatusReply(reply.args);
    case '/version.reply':
      return formatVersionReply(reply.args);
    default:
      return `${reply.address} ${reply.args.join(' ')}`;
  }
}

export function LogOutputPanel() {
  const entries = logger.useStore((s) => s.entries);

  useEffect(() => {
    const onMessage = oscService.on("*", (...args: unknown[]) => {
      const msg = args[0] as InstanceType<typeof OSC.Message>;
      const reply: OscReply = {address: msg.address, args: msg.args as unknown[]};
      logger.log(formatOscReply(reply));
    });
    const onOpen = oscService.on("open", () => logger.log("Connected."));
    const onClose = oscService.on("close", () => logger.log("Disconnected."));
    const onError = oscService.on("error", (err: unknown) => logger.log(`Error: ${err}`));

    return () => {
      oscService.off("*", onMessage);
      oscService.off("open", onOpen);
      oscService.off("close", onClose);
      oscService.off("error", onError);
    };
  }, []);

  return (
    <>
      <div className="log-header">
        <button onClick={() => logger.clear()}>Clear</button>
      </div>
      <div className="log-output">
        {entries.map((entry, i) => (
          <div key={i} className="log-entry">
            {entry}
          </div>
        ))}
      </div>
    </>
  );
}
