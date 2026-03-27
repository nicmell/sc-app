import {useSelector} from "@/lib/stores/store";
import scsynth from "@/lib/stores/scsynth";
import options from "@/lib/stores/options";

export function DashboardFooter() {
    const address = useSelector(options.selectors.address);
    const statusText = useSelector(scsynth.selectors.statusText);

    return (
        <footer className="footer">
            <span className="server-address">{address}</span>
            <span className="server-status">{statusText}</span>
        </footer>
    );
}
