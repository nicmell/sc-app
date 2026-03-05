import {useSelector} from "@/lib/stores/store";
import scsynth from "@/lib/stores/scsynth";

export function DashboardFooter() {
    const status = useSelector(scsynth.selectors.status);

    return (
        <footer className="footer">
            <span className="server-status">
                UGens: {status.ugens} | Synths: {status.synths} | Groups: {status.groups} | Defs: {status.defs} | CPU: {status.avgCpu.toFixed(1)}% / {status.peakCpu.toFixed(1)}% | SR: {status.sampleRate.toFixed(0)} Hz
            </span>
        </footer>
    );
}
