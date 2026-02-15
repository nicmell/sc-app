import {useState, useRef, useEffect, useCallback, type ReactNode, type Ref} from "react";
import {useSelector} from "@/lib/stores/store";
import pluginsStore from "@/lib/stores/plugins";
import type {PluginInfo} from "@/types/stores";
import {pluginUrl} from "@/lib/storage/pluginStorage";
import {Modal} from "@/components/Modal";
import "./DashboardPanel.scss";

interface DashboardPanelProps {
  title: string;
  children?: ReactNode;
  onClose?: () => void;
  ref?: Ref<HTMLDivElement>;
  style?: React.CSSProperties;
  className?: string;
}

const ALLOWED_TAGS = new Set([
  'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'a', 'img', 'audio', 'video', 'source',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'br', 'hr', 'em', 'strong', 'b', 'i', 'u', 'code', 'pre',
  'label', 'input', 'select', 'option', 'button', 'textarea',
  'link', 'style', 'section', 'article', 'header', 'footer', 'nav', 'main',
  'sc-fader', 'sc-toggle',
]);

function sanitize(doc: Document) {
  // Remove all script, iframe, object, embed, form elements
  doc.querySelectorAll('script, iframe, object, embed, form').forEach(el => el.remove());

  // Remove event handler attributes and javascript: URLs from all elements
  const walk = document.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT);
  let node: Element | null;
  while ((node = walk.nextNode() as Element | null)) {
    const tag = node.tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tag) && !tag.startsWith('sc-')) {
      node.remove();
      continue;
    }
    for (const attr of Array.from(node.attributes)) {
      if (attr.name.startsWith('on') || attr.value.trimStart().startsWith('javascript:')) {
        node.removeAttribute(attr.name);
      }
    }
  }
}

function rewriteUrls(doc: Document, baseUrl: string) {
  const rewrite = (el: Element, attr: string) => {
    const val = el.getAttribute(attr);
    if (val && !val.startsWith('http') && !val.startsWith('data:') && !val.startsWith('plugins://')) {
      el.setAttribute(attr, baseUrl + val);
    }
  };

  doc.querySelectorAll('img[src], audio[src], video[src]').forEach(el => rewrite(el, 'src'));
  doc.querySelectorAll('link[href]').forEach(el => rewrite(el, 'href'));

  doc.querySelectorAll('style').forEach(style => {
    style.textContent = (style.textContent ?? '').replace(
      /url\(["']?(?!https?:|data:|plugins:\/\/)(.*?)["']?\)/g,
      (_, p) => `url(${baseUrl}${p})`
    );
  });
}

function parsePluginHtml(html: string, baseUrl: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  sanitize(doc);
  rewriteUrls(doc, baseUrl);
  return doc.head.innerHTML + doc.body.innerHTML;
}

export function DashboardPanel({title, children, onClose, ref, style, className, ...rest}: DashboardPanelProps) {
  const plugins = useSelector(pluginsStore.selectors.items);
  const [modalOpen, setModalOpen] = useState(true);
  const [selectedPlugin, setSelectedPlugin] = useState<PluginInfo | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleSelect = (plugin: PluginInfo) => {
    setSelectedPlugin(plugin);
    setModalOpen(false);
  };

  const loadPlugin = useCallback(async (plugin: PluginInfo) => {
    const container = containerRef.current;
    if (!container) return;

    const entryUrl = pluginUrl(plugin.name, plugin.version, plugin.entry);
    const baseUrl = `plugins://${plugin.name}/${plugin.version}/`;

    try {
      const resp = await fetch(entryUrl);
      const html = await resp.text();
      const sanitized = parsePluginHtml(html, baseUrl);

      const shadow = container.shadowRoot ?? container.attachShadow({mode: 'open'});
      shadow.innerHTML = sanitized;
    } catch {
      const shadow = container.shadowRoot ?? container.attachShadow({mode: 'open'});
      shadow.innerHTML = '<div style="opacity:0.5;text-align:center;padding:1rem">Failed to load plugin</div>';
    }
  }, []);

  useEffect(() => {
    if (!selectedPlugin) return;
    loadPlugin(selectedPlugin);
    return () => {
      const shadow = containerRef.current?.shadowRoot;
      if (shadow) shadow.innerHTML = '';
    };
  }, [selectedPlugin, loadPlugin]);

  return (
    <div ref={ref} style={style} className={`dashboard-panel ${className ?? ""}`} {...rest}>
      <div className="dashboard-panel-header">
        <span className="dashboard-panel-title">{title}</span>
        {selectedPlugin && (
          <button
            className="dashboard-panel-header-btn"
            onMouseDown={e => e.stopPropagation()}
            onClick={() => setModalOpen(true)}
          >
            &#8943;
          </button>
        )}
        {onClose && (
          <button
            className="dashboard-panel-close"
            onMouseDown={e => e.stopPropagation()}
            onClick={onClose}
          >
            &times;
          </button>
        )}
      </div>
      <div className="dashboard-panel-body">
        {!selectedPlugin && !modalOpen && (
          <div className="dashboard-panel-empty">
            No plugin selected
            <button className="dashboard-panel-select-btn" onClick={() => setModalOpen(true)}>
              Select plugin
            </button>
          </div>
        )}
        {selectedPlugin && (
          <div ref={containerRef} className="dashboard-panel-content" />
        )}
      </div>

      {children}

      <Modal open={modalOpen} title="Select plugin" onClose={() => setModalOpen(false)}>
        {plugins.length === 0 ? (
          <div className="dashboard-panel-empty">No plugins available</div>
        ) : (
          <ul className="dashboard-panel-plugin-list">
            {plugins.map(p => (
              <li key={p.name}>
                <button onClick={() => handleSelect(p)}>
                    <span className="dashboard-panel-plugin-name">{p.name}</span>
                    <span className="dashboard-panel-plugin-meta">{p.author} &middot; v{p.version}</span>
                  </button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
}
