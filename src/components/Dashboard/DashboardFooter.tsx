import {useSelector} from "@/lib/stores/store";
import root from "@/lib/stores/root";
import options from "@/lib/stores/options";

export function DashboardFooter() {
    const address = useSelector(options.selectors.address);
    const statusText = useSelector(root.selectors.statusText);

    return (
        <footer className="footer">
            <span className="server-address">{address}</span>
            <span className="server-status">{statusText}</span>
        </footer>
    );
}
