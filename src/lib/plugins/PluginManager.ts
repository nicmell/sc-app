import DOMPurify, {type RemovedElement, type RemovedAttribute} from "dompurify";
import {trustedTypes} from "trusted-types";
import type {PluginInfo} from "@/types/stores";
import {pluginUrl} from "@/lib/storage/pluginStorage";

export interface SanitizeViolation {
  type: 'element' | 'attribute';
  detail: string;
}

export interface PluginLoadResult {
  html: TrustedHTML;
  violations: SanitizeViolation[];
}

export class PluginManager {
  private purify = DOMPurify(window);
  private policy;

  constructor() {
    // Trusted Types policy — single approved gateway for plugin HTML injection.
    // The policy is an identity function: sanitization happens before createHTML
    // is called, and URL rewriting is handled by the Rust backend.
    this.policy = trustedTypes.createPolicy('plugin-html', {
      createHTML: (html: string) => html,
    });
  }

  async load(plugin: PluginInfo): Promise<PluginLoadResult> {
    const entryUrl = pluginUrl(plugin.name, plugin.version, plugin.entry);

    const resp = await fetch(entryUrl);
    if (!resp.ok) {
      throw new Error(`Failed to fetch plugin "${plugin.name}": ${resp.status} ${resp.statusText}`);
    }

    const raw = await resp.text();
    const clean = this.sanitize(raw);
    const violations = this.collectViolations();
    const html = this.policy.createHTML(clean);
    return {html, violations};
  }

  private sanitize(html: string): string {
    return this.purify.sanitize(html, {
      ADD_ATTR: ['node-id', 'param', 'min', 'max', 'step', 'value', 'label', 'active'],
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
      WHOLE_DOCUMENT: true,
      CUSTOM_ELEMENT_HANDLING: {
        tagNameCheck: /^sc-/,
        attributeNameCheck: /^(node-id|param|min|max|step|value|label|active)$/,
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
