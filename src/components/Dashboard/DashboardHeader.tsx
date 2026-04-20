import {useCallback, useState} from "react";
import {store} from "@/lib/stores/store";
import {rootApi} from "@/lib/stores/api";
import {IconButton} from "@/components/ui/IconButton";
import {SettingsDrawer} from "@/components/SettingsDrawer";
import {oscService} from "@/lib/osc";
import {useClockState, type ClockStateDto} from "@/lib/clock/useClockState";

export function DashboardHeader() {
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [running, setRunning] = useState(false);
    const clockState = useClockState();

    const toggleDefaultGroup = useCallback(() => {
        const next = !running;
        setRunning(next);
        const groupId = oscService.defaultGroupId();
        oscService.setNodeRun(groupId, next ? 1 : 0);
        rootApi.setRunning({isRunning: next});
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
                <ClockIndicator state={clockState}/>
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

function ClockIndicator({state}: {state: ClockStateDto | null}) {
    // Visual mapping:
    //   running — green, steady. Broadcaster's /tr is flowing, readers anchored.
    //   waiting — amber, pulsing. Broadcaster not yet emitted /tr (startup window).
    //   silent  — red. Anchor went stale; writer paused (stopped from UI).
    //   null    — grey. Clock service off or unavailable (e.g. serve mode).
    const kind = state?.kind ?? 'off';
    const color =
        kind === 'running' ? 'var(--color-primary, #3a7)' :
        kind === 'waiting' ? '#c93' :
        kind === 'silent'  ? '#b33' :
        '#666';
    const label = kind === 'running'
        ? `Clock: running${state && state.kind === 'running' ? ` (${state.samples} samples)` : ''}`
        : `Clock: ${kind}`;
    return (
        <span
            title={label}
            aria-label={label}
            style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: color,
                marginLeft: 4,
                flexShrink: 0,
                animation: kind === 'waiting' ? 'clock-pulse 1s ease-in-out infinite' : undefined,
            }}
        />
    );
}
