import {useSelector} from "@/lib/stores/store";
import scsynth from "@/lib/stores/scsynth";

export function DashboardFooter() {
    const address = useSelector(scsynth.selectors.address);
    const statusText = useSelector(scsynth.selectors.statusText);

    return (
        <footer className="footer">
            <span className="server-address">{address}</span>
            <span className="server-status">{statusText}</span>
        </footer>
    );
}
