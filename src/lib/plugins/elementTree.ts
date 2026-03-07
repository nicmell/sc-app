import {ELEMENTS} from "@/constants/sc-elements";
import {generateId} from "@/lib/utils/generateId";

export type ScElementNode = {
  id: string;
  tagName: string;
  attributes: Record<string, string>;
  descendants: ScElementNode[];
}

const tagNames = new Set<string>(Object.values(ELEMENTS));
const STORAGE_KEY = 'sc-plugin-trees';

export function loadSavedTree(boxId: string): ScElementNode[] | undefined {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}:${boxId}`);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

export function saveSavedTree(boxId: string, tree: ScElementNode[]): void {
  localStorage.setItem(`${STORAGE_KEY}:${boxId}`, JSON.stringify(tree));
}

export function buildScElementTree(node: Element, saved?: ScElementNode[], offset = 0): ScElementNode[] {
  const result: ScElementNode[] = [];
  for (const child of Array.from(node.children)) {
    const tag = child.tagName.toLowerCase();
    if (!tagNames.has(tag)) {
      result.push(...buildScElementTree(child, saved, offset + result.length));
      continue;
    }
    const idx = offset + result.length;
    const prev = saved?.[idx];
    const rehydrated = prev?.tagName === tag;
    if (prev && !rehydrated) {
      console.warn(`[plugin hydration] mismatch at index ${idx}: <${tag}> vs saved <${prev.tagName}>`);
    }

    const id = rehydrated ? prev.id : generateId();
    child.setAttribute('id', id);

    const attributes: Record<string, string> = {};
    for (const attr of Array.from(child.attributes)) {
      attributes[attr.name] = attr.value;
    }
    const descendants = buildScElementTree(child, rehydrated ? prev.descendants : undefined);
    result.push({ id, tagName: tag, attributes, descendants });
  }
  if (offset === 0 && saved && result.length < saved.length) {
    console.warn(`[plugin hydration] ${saved.length - result.length} saved node(s) no longer present`);
  }
  return result;
}
