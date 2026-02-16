import DOMPurify, {type RemovedElement, type RemovedAttribute} from "dompurify";
import {trustedTypes} from "trusted-types";
import type {PluginInfo, RootState} from "@/types/stores";
import {pluginUrl, addPlugin, removePlugin} from "@/lib/storage/pluginStorage";
import {pluginsApi} from "@/lib/stores/api";
import {store, rehydrate} from "@/lib/stores/store";

export interface PluginFetchError {
  code: number;
  message: string;
}

export interface SanitizeViolation {
  type: 'element' | 'attribute';
  detail: string;
}

export class PluginManager {
  private purify = DOMPurify(window);
  private policy;
  private cache = new Map<string, TrustedHTML>();

  constructor() {
    this.policy = trustedTypes.createPolicy('plugin-html', {
      createHTML: (html: string) => this.sanitize(html),
    });
  }

  async load(plugin: PluginInfo): Promise<void> {
    const entryUrl = pluginUrl(plugin.name, plugin.version, plugin.entry);
    const resp = await fetch(entryUrl);

    if (resp.ok) {
      const raw = await resp.text();
      const html = this.policy.createHTML(raw);
      const violations = this.collectViolations();
      this.cache.set(plugin.id, html);
      pluginsApi.loadPlugin({
        id: plugin.id,
        loaded: true,
        violations: violations.length > 0 ? violations.map(v => v.detail) : undefined,
      });
    } else {
      pluginsApi.loadPlugin({
        id: plugin.id,
        loaded: false,
        error: {code: resp.status, message: resp.statusText},
      });
    }
  }

  async addPlugin(file: File): Promise<void> {
    const plugin = await addPlugin(file);
    this.cache.delete(plugin.id);
    pluginsApi.addPlugin(plugin);
    await rehydrate();
  }

  async removePlugin(plugin: PluginInfo): Promise<void> {
    await removePlugin(plugin.id);
    this.cache.delete(plugin.id);
    pluginsApi.removePlugin(plugin.id);
    await rehydrate();

  }

  async loadAll(): Promise<void> {
    const {items} = (store.getState() as RootState).plugins;
    const pending = items.filter(p => p.loaded === undefined);
    await Promise.all(pending.map(p => this.load(p)));
  }

  getHtml(id: string): TrustedHTML | undefined {
    return this.cache.get(id);
  }

  private sanitize(html: string): string {
    return this.purify.sanitize(html, {
      RETURN_TRUSTED_TYPE: false,
      ADD_ATTR: ['node-id', 'param', 'min', 'max', 'step', 'value', 'label', 'checked'],
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
      WHOLE_DOCUMENT: true,
      CUSTOM_ELEMENT_HANDLING: {
        tagNameCheck: /^sc-/,
        attributeNameCheck: /^(node-id|param|min|max|step|value|label|checked)$/,
        allowCustomizedBuiltInElements: false,
      },
    });
  }

  private collectViolations(): SanitizeViolation[] {
    const violations: SanitizeViolation[] = [];

    for (const item of this.purify.removed) {
      if ('element' in item) {
        const {element} = item as RemovedElement;
        if (element instanceof Element) {
          violations.push({type: 'element', detail: `<${element.tagName.toLowerCase()}> removed`});
        }
      } else if ('attribute' in item) {
        const {attribute, from} = item as RemovedAttribute;
        const tag = from instanceof Element ? from.tagName.toLowerCase() : '?';
        violations.push({type: 'attribute', detail: `${attribute?.name} on <${tag}> removed`});
      }
    }

    return violations;
  }
}

export const pluginManager = new PluginManager();
