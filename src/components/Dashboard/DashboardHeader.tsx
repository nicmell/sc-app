import {useCallback, useState} from "react";
import {store} from "@/lib/stores/store";
import {nodesApi} from "@/lib/stores/api";
import {IconButton} from "@/components/ui/IconButton";
import {SettingsDrawer} from "@/components/SettingsDrawer";
import {oscService} from "@/lib/osc";
import {nodeRunMessage} from "@/lib/osc/messages";

export function DashboardHeader() {
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [running, setRunning] = useState(false);

    const toggleDefaultGroup = useCallback(() => {
        const next = !running;
        setRunning(next);
        const groupId = oscService.defaultGroupId();
        nodesApi.setRunning({nodeId: groupId, isRunning: next});
        oscService.send(nodeRunMessage(groupId, next ? 1 : 0));
    }, [running]);

    return (
        <>
            <header className="header">
                <span className="header-title">SC-App</span>
                <IconButton size="md" onClick={toggleDefaultGroup} aria-label={running ? "Stop" : "Play"}>
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
                        {running
                            ? <>
                                <rect x="4" y="3.5" width="3" height="11" rx="1"/>
                                <rect x="11" y="3.5" width="3" height="11" rx="1"/>
                              </>
                            : <polygon points="5,2.5 5,15.5 15,9"/>}
                    </svg>
                </IconButton>
                <span className="header-spacer"/>
                <button className="header-log-btn" onClick={() => console.log(store.getState())}>Log</button>
                <IconButton size="md" onClick={() => setSettingsOpen(true)} aria-label="Menu">
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
                        <rect y="3" width="20" height="2" rx="1"/>
                        <rect y="9" width="20" height="2" rx="1"/>
                        <rect y="15" width="20" height="2" rx="1"/>
                    </svg>
                </IconButton>
            </header>
            <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)}/>
        </>
    );
}
