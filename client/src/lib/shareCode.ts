import { decode as msgpackDecode, encode as msgpackEncode } from '@msgpack/msgpack';
import type { DiagramFile } from '@/lib/fileUtils';
import { buildSeedDataFromCatalogItem, type CatalogItem } from '@/lib/catalogNodeDefaults';

/** Gzip-compressed MessagePack wire v2 (catalog refs + deltas). */
export const SHARE_CODE_PREFIX = 'ccc2';

const OMIT_KEYS = new Set(['onDelete', 'onUpdate', '_updated', '_edgeUpdated']);

function jsonReplacer(key: string, value: unknown): unknown {
  if (OMIT_KEYS.has(key)) return undefined;
  if (typeof value === 'function') return undefined;
  return value;
}

function sanitizeDiagramForShare(diagram: DiagramFile): DiagramFile {
  return JSON.parse(JSON.stringify(diagram, jsonReplacer)) as DiagramFile;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Drop React Flow runtime fields and edge styling that we recompute on load. */
function compactDiagramForShare(diagram: DiagramFile): DiagramFile {
  const data = diagram.data as Record<string, unknown> | undefined;
  if (!data || typeof data !== 'object') return diagram;

  const rawNodes = data.nodes;
  const rawEdges = data.edges;
  const nodes = Array.isArray(rawNodes)
    ? rawNodes.map((n) => {
        const node = n as Record<string, unknown>;
        const pos = node.position as { x?: number; y?: number } | undefined;
        const compact: Record<string, unknown> = {
          id: node.id,
          type: node.type,
          position:
            pos && typeof pos.x === 'number' && typeof pos.y === 'number'
              ? { x: round2(pos.x), y: round2(pos.y) }
              : node.position,
          data: node.data,
        };
        if (node.parentNode != null) compact.parentNode = node.parentNode;
        if (node.extent != null) compact.extent = node.extent;
        if (typeof node.zIndex === 'number') compact.zIndex = node.zIndex;
        if (node.hidden === true) compact.hidden = true;
        return compact;
      })
    : [];

  const edges = Array.isArray(rawEdges)
    ? rawEdges.map((e) => {
        const edge = e as Record<string, unknown>;
        const compact: Record<string, unknown> = {
          id: edge.id,
          source: edge.source,
          target: edge.target,
        };
        if (edge.sourceHandle) compact.sourceHandle = edge.sourceHandle;
        if (edge.targetHandle) compact.targetHandle = edge.targetHandle;
        if (edge.type && edge.type !== 'default') compact.type = edge.type;
        const d = edge.data as Record<string, unknown> | undefined;
        if (d && d.outputType != null) {
          compact.data = { outputType: d.outputType };
        }
        return compact;
      })
    : [];

  const next: Record<string, unknown> = { nodes, edges };
  const vp = data.viewport as { x?: number; y?: number; zoom?: number } | undefined;
  if (vp && typeof vp === 'object') {
    const zx = typeof vp.x === 'number' ? round2(vp.x) : vp.x;
    const zy = typeof vp.y === 'number' ? round2(vp.y) : vp.y;
    const zz = typeof vp.zoom === 'number' ? Math.round(vp.zoom * 1000) / 1000 : vp.zoom;
    const isDefault = zx === 0 && zy === 0 && (zz === 1 || zz === undefined);
    if (!isDefault) {
      next.viewport = { x: zx, y: zy, zoom: zz };
    }
  }

  return { name: diagram.name, data: next };
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(s: string): Uint8Array {
  let base64 = s.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function gzipBytes(input: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream === 'undefined') {
    throw new Error('This browser does not support sharing (CompressionStream missing).');
  }
  const stream = new Blob([input]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gunzipBytes(input: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('This browser does not support importing shares (DecompressionStream missing).');
  }
  const stream = new Blob([input]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function deepEqual(a: unknown, b: unknown): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

function computeDelta(actual: Record<string, unknown>, defaults: Record<string, unknown>): Record<string, unknown> {
  const delta: Record<string, unknown> = {};
  for (const key of Object.keys(actual)) {
    if (OMIT_KEYS.has(key)) continue;
    if (!(key in defaults)) {
      delta[key] = actual[key];
      continue;
    }
    if (!deepEqual(actual[key], defaults[key])) {
      delta[key] = actual[key];
    }
  }
  return delta;
}

function wireEdgesFromCompact(edges: unknown[]): Array<Record<string, unknown>> {
  if (!Array.isArray(edges)) return [];
  return edges.map((e) => {
    const edge = e as Record<string, unknown>;
    const o: Record<string, unknown> = { i: edge.id, s: edge.source, t: edge.target };
    if (edge.sourceHandle) o.h = edge.sourceHandle;
    if (edge.targetHandle) o.H = edge.targetHandle;
    const d = edge.data as Record<string, unknown> | undefined;
    if (d && d.outputType != null) o.o = d.outputType;
    return o;
  });
}

function parseWireEdges(eds: unknown): unknown[] {
  if (!Array.isArray(eds)) return [];
  return eds.map((raw) => {
    const e = raw as Record<string, unknown>;
    const edge: Record<string, unknown> = { id: e.i, source: e.s, target: e.t };
    if (e.h) edge.sourceHandle = e.h;
    if (e.H) edge.targetHandle = e.H;
    if (e.o != null) edge.data = { outputType: e.o };
    return edge;
  });
}

function viewportToWire(vp: unknown): [number, number, number] | undefined {
  if (!vp || typeof vp !== 'object') return undefined;
  const v = vp as { x?: number; y?: number; zoom?: number };
  const zx = typeof v.x === 'number' ? round2(v.x) : 0;
  const zy = typeof v.y === 'number' ? round2(v.y) : 0;
  const zz = typeof v.zoom === 'number' ? Math.round(v.zoom * 1000) / 1000 : 1;
  if (zx === 0 && zy === 0 && zz === 1) return undefined;
  return [zx, zy, zz];
}

function wireToViewport(w: unknown): Record<string, number> | undefined {
  if (!Array.isArray(w) || w.length < 3) return undefined;
  return { x: Number(w[0]), y: Number(w[1]), zoom: Number(w[2]) };
}

function encodeNodesWire(
  nodes: unknown[],
  itemsById: Map<number, CatalogItem>,
): unknown[] {
  if (!Array.isArray(nodes)) return [];
  const out: unknown[] = [];

  for (const n of nodes) {
    const node = n as Record<string, unknown>;
    const data = (node.data || {}) as Record<string, unknown>;
    const pos = node.position as { x?: number; y?: number };
    const px = typeof pos?.x === 'number' ? round2(pos.x) : 0;
    const py = typeof pos?.y === 'number' ? round2(pos.y) : 0;
    const flowId = String(node.id ?? '');
    const itemId = typeof data.itemId === 'number' ? data.itemId : undefined;
    const item = itemId != null ? itemsById.get(itemId) : undefined;

    const fullPayload = ['f', node] as unknown[];

    if (!item) {
      out.push(fullPayload);
      continue;
    }

    if (!deepEqual(data.specs, item.specs)) {
      out.push(fullPayload);
      continue;
    }

    const defaults = buildSeedDataFromCatalogItem(item) as Record<string, unknown>;
    const delta = computeDelta(data, defaults);
    const deltaObj = Object.keys(delta).length ? delta : null;
    const refPayload = ['r', flowId, itemId, px, py, deltaObj] as unknown[];

    if (msgpackEncode(refPayload).byteLength <= msgpackEncode(fullPayload).byteLength) {
      out.push(refPayload);
    } else {
      out.push(fullPayload);
    }
  }

  return out;
}

function decodeNodesWire(nds: unknown, itemsById: Map<number, CatalogItem>): unknown[] {
  if (!Array.isArray(nds)) return [];

  return nds.map((entry) => {
    if (!Array.isArray(entry) || entry.length < 2) {
      throw new Error('Invalid share: bad node entry.');
    }
    const tag = entry[0];
    if (tag === 'f') {
      const n = entry[1];
      if (!n || typeof n !== 'object') throw new Error('Invalid share: full node payload.');
      return n;
    }
    if (tag === 'r') {
      if (entry.length < 6) throw new Error('Invalid share: ref node too short.');
      const flowId = String(entry[1]);
      const catalogId = Number(entry[2]);
      const px = Number(entry[3]);
      const py = Number(entry[4]);
      const deltaRaw = entry[5];
      const item = itemsById.get(catalogId);
      if (!item) {
        throw new Error(`Invalid share: unknown catalog item id ${catalogId}.`);
      }
      const defaults = buildSeedDataFromCatalogItem(item) as Record<string, unknown>;
      const delta =
        deltaRaw && typeof deltaRaw === 'object' && !Array.isArray(deltaRaw)
          ? (deltaRaw as Record<string, unknown>)
          : {};
      const merged = { ...defaults, ...delta };
      return {
        id: flowId,
        type: 'equipment',
        position: { x: px, y: py },
        data: merged,
      };
    }
    throw new Error('Invalid share: unknown node tag.');
  });
}

export async function encodeDiagramShareCode(
  diagram: DiagramFile,
  items: CatalogItem[],
): Promise<string> {
  const clean = sanitizeDiagramForShare(diagram);
  const compact = compactDiagramForShare(clean);
  const data = compact.data as Record<string, unknown>;
  const itemsById = new Map(items.map((i) => [i.id, i]));

  const nds = encodeNodesWire(data.nodes ?? [], itemsById);
  const eds = wireEdgesFromCompact(data.edges ?? []);
  const vp = viewportToWire(data.viewport);

  const wire = {
    v: 2 as const,
    n: compact.name,
    ...(vp ? { vp } : {}),
    nds,
    eds,
  };

  const packed = msgpackEncode(wire);
  const gz = await gzipBytes(packed);
  return SHARE_CODE_PREFIX + bytesToBase64Url(gz);
}

export async function decodeDiagramShareCode(
  code: string,
  items: CatalogItem[],
): Promise<DiagramFile> {
  const trimmed = code.trim().replace(/^#/, '');
  if (!trimmed.startsWith(SHARE_CODE_PREFIX)) {
    throw new Error(`Not a valid setup code (must start with ${SHARE_CODE_PREFIX}).`);
  }
  const b64 = trimmed.slice(SHARE_CODE_PREFIX.length);
  if (!b64) throw new Error('Setup code is empty.');
  const compressed = base64UrlToBytes(b64);
  const raw = await gunzipBytes(compressed);
  const doc = msgpackDecode(raw) as Record<string, unknown>;

  if (Number(doc?.v) !== 2 || typeof doc.n !== 'string') {
    throw new Error('Decoded data is not a valid diagram (wrong format).');
  }

  const itemsById = new Map(items.map((i) => [i.id, i]));
  const nodes = decodeNodesWire(doc.nds, itemsById);
  const edges = parseWireEdges(doc.eds);
  const viewport = wireToViewport(doc.vp);

  const flow: Record<string, unknown> = { nodes, edges };
  if (viewport) flow.viewport = viewport;

  return { name: doc.n, data: flow };
}

export type { CatalogItem } from '@/lib/catalogNodeDefaults';
