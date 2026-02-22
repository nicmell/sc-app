import {useCallback, useMemo, useState, useSyncExternalStore} from "react";
import type {Layout} from "react-grid-layout";
import {GridLayout, noCompactor, useContainerWidth} from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import {useSelector} from "@/lib/stores/store";
import layoutStore from "@/lib/stores/layout";
import {layoutApi, pluginsApi} from "@/lib/stores/api";
import {store} from "@/lib/stores/store";
import {DashboardPanel} from "./DashboardPanel";
import {deepEqual} from "@/lib/utils/deepEqual";
import {SettingsDrawer} from "@/components/SettingsDrawer";
import {IconButton} from "@/components/ui/IconButton";
import {computePlaceholders, isPlaceholder, MARGIN} from "./utils";
import {Placeholder} from "./Placeholder";
import "./Dashboard.scss";
import {BoxItem, PluginInfo} from "@/types/stores";
import {PluginLoader} from "@/components/Dashboard/PluginLoader/PluginLoader.tsx";
import {Button} from "@/components/ui/Button";
import {Modal} from "@/components/ui/Modal";
import {PluginList} from "@/components/PluginList";


const HEADER_HEIGHT = 48;
const FOOTER_HEIGHT = 42;

function subscribeToResize(cb: () => void) {
    window.addEventListener("resize", cb);
    return () => window.removeEventListener("resize", cb);
}

function getViewportHeight() {
    return window.innerHeight;
}

function computeRowHeight(numRows: number, viewportHeight: number): number {
    const available = viewportHeight - HEADER_HEIGHT - FOOTER_HEIGHT;
    return Math.floor((available - MARGIN[1] * (numRows + 1)) / numRows);
}


function boxId() {
    return `box-${Date.now()}`
}

export function Dashboard() {
    const [settingsOpen, setSettingsOpen] = useState(false);
    const layout = useSelector(layoutStore.selectors.items);
    const {numRows, numColumns} = useSelector(layoutStore.selectors.options);
    const {width: containerWidth, containerRef, mounted} = useContainerWidth({measureBeforeMount: true});
    const viewportHeight = useSyncExternalStore(subscribeToResize, getViewportHeight);
    const rowHeight = computeRowHeight(numRows, viewportHeight);

    const [modalOpen, setModalOpen] = useState<BoxItem>();

    const actualNumRows = useMemo(() => {
        return layout.reduce((max, item) => Math.max(max, item.y + item.h), 1);
    }, [layout])

    const placeholders = useMemo(() => {
        return computePlaceholders(layout, Math.max(actualNumRows, numRows), numColumns)
    }, [layout, actualNumRows, numRows, numColumns]);

    const syncLayout = (current: Layout) => {
        const boxMap = new Map(layout.map(item => [item.i, item]));
        const active = current
            .filter((item) => !isPlaceholder(item))
            .map(({i, x, y, w, h}) => {
                const prev = boxMap.get(i);
                return {i, x, y, w, h, plugin: prev?.plugin, loaded: prev?.loaded, error: prev?.error};
            });
        if (!deepEqual(active, layout)) {
            layoutApi.setLayout(active);
        }
    };

    const handleSelectPlugin = useCallback((plugin: PluginInfo) => {
        const item = modalOpen!;
        if (isPlaceholder(item)) {
            layoutApi.addBox({i: boxId(), x: item.x, y: item.y, w: item.w, h: item.h, plugin: plugin.id})
        } else {
            layoutApi.setBoxPlugin({id: item.i, plugin: plugin.id});
        }
        setModalOpen(undefined);
    }, [modalOpen])

    const renderDashboardPanel = (item: BoxItem) => {
        const plugin = item.plugin ? pluginsApi.getById(item.plugin) : undefined;
        const fallback = (
            <div className="dashboard-panel-empty">
                Plugin not found
                <Button size="sm" onClick={() => setModalOpen(item)}>
                    Select plugin
                </Button>
            </div>
        );
        return (
            <DashboardPanel
                key={item.i}
                title={item.i}
                boxId={item.i}
                pluginId={item.plugin}
                onClose={() => layoutApi.removeBox(item.i)}
                onEdit={() => setModalOpen(item)}
            >
                {
                    plugin
                        ? <PluginLoader box={item} plugin={plugin}/>
                        : fallback
                }
            </DashboardPanel>
        )
    }

    const placeholderElements = useMemo(() => placeholders.map(item => (
        <Placeholder
            key={item.i}
            item={item}
            containerWidth={containerWidth}
            cols={numColumns}
            rowHeight={rowHeight}
            onClick={() => setModalOpen(item)}
        />
    )), [placeholders, numColumns, containerWidth, rowHeight]);

    const items = layout.map(item => renderDashboardPanel(item))

    return (
        <div className="dashboard">
            <header className="header">
                <span className="header-title">SC-App</span>
                <IconButton size="md" onClick={() => console.log(store.getState())} aria-label="Log state">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                    </svg>
                </IconButton>
                <IconButton size="md" onClick={() => setSettingsOpen(true)} aria-label="Menu">
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
                        <rect y="3" width="20" height="2" rx="1"/>
                        <rect y="9" width="20" height="2" rx="1"/>
                        <rect y="15" width="20" height="2" rx="1"/>
                    </svg>
                </IconButton>
            </header>

            <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)}/>

            <div className="dashboard-grid-wrapper" ref={containerRef as React.RefObject<HTMLDivElement>}>
                {mounted && (
                    <div className="dashboard-grid-container">
                        <GridLayout
                            className="dashboard-grid"
                            width={containerWidth}
                            layout={layout}
                            gridConfig={{cols: numColumns, rowHeight, margin: MARGIN}}
                            compactor={{...noCompactor, allowOverlap: false, preventCollision: true}}
                            dragConfig={{handle: ".dashboard-panel-header"}}
                            onDragStop={(current) => syncLayout(current)}
                            onResizeStop={(current) => syncLayout(current)}
                        >
                            {items}
                        </GridLayout>
                        {placeholderElements}
                    </div>
                )}
            </div>
            <footer className="footer">
                <span className="server-status">Empty Box Grid</span>
            </footer>
            <Modal open={!!modalOpen} title="Select plugin" onClose={() => setModalOpen(undefined)}>
                <PluginList onSelect={handleSelectPlugin}/>
            </Modal>
        </div>
    );
}
