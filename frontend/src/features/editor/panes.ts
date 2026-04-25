/**
 * Modelo recursivo de panes para o editor (estilo window-tile).
 *
 * Um `PaneNode` é uma `LeafPane` (com tabs) ou um `SplitPane` (com dois filhos
 * dispostos horizontal/vertical). Funções aqui são puras e imutáveis — o estado
 * vive no `App.tsx` via `useState<PaneNode>`.
 */

export type PaneId = string;

export type PaneTab = { path: string; content: string; dirty: boolean };

export type LeafPane = {
  kind: "leaf";
  id: PaneId;
  tabs: PaneTab[];
  activePath: string;
};

export type SplitPane = {
  kind: "split";
  id: PaneId;
  direction: "horizontal" | "vertical";
  /** tamanho 0–100 do filho `a`; `b` ocupa o complementar */
  size: number;
  a: PaneNode;
  b: PaneNode;
};

export type PaneNode = LeafPane | SplitPane;

export type DropSide = "center" | "left" | "right" | "top" | "bottom";

let _idCounter = 0;
export function newPaneId(): PaneId {
  _idCounter += 1;
  return `pane_${Date.now().toString(36)}_${_idCounter}`;
}

export function emptyLeaf(): LeafPane {
  return { kind: "leaf", id: newPaneId(), tabs: [], activePath: "" };
}

// ── Travessia ────────────────────────────────────────────────────────────────

export function getAllLeaves(node: PaneNode): LeafPane[] {
  if (node.kind === "leaf") return [node];
  return [...getAllLeaves(node.a), ...getAllLeaves(node.b)];
}

export function findLeafById(node: PaneNode, id: PaneId): LeafPane | null {
  if (node.kind === "leaf") return node.id === id ? node : null;
  return findLeafById(node.a, id) ?? findLeafById(node.b, id);
}

/** Primeiro leaf que contém uma tab com `path` (ou null). */
export function findLeafWithPath(node: PaneNode, path: string): LeafPane | null {
  if (node.kind === "leaf") {
    return node.tabs.some((t) => t.path === path) ? node : null;
  }
  return findLeafWithPath(node.a, path) ?? findLeafWithPath(node.b, path);
}

// ── Atualização imutável ─────────────────────────────────────────────────────

function mapNode(node: PaneNode, fn: (n: PaneNode) => PaneNode): PaneNode {
  const mapped = fn(node);
  if (mapped !== node) return mapped;
  if (node.kind === "split") {
    const a = mapNode(node.a, fn);
    const b = mapNode(node.b, fn);
    if (a !== node.a || b !== node.b) return { ...node, a, b };
  }
  return node;
}

export function updateLeaf(root: PaneNode, id: PaneId, fn: (leaf: LeafPane) => LeafPane): PaneNode {
  return mapNode(root, (n) => (n.kind === "leaf" && n.id === id ? fn(n) : n));
}

/** Aplica `fn` em todos os leafs (útil para updateFile global). */
export function updateAllLeaves(root: PaneNode, fn: (leaf: LeafPane) => LeafPane): PaneNode {
  return mapNode(root, (n) => (n.kind === "leaf" ? fn(n) : n));
}

// ── Operações de tab ─────────────────────────────────────────────────────────

export function openTabInLeaf(leaf: LeafPane, tab: PaneTab): LeafPane {
  const existing = leaf.tabs.find((t) => t.path === tab.path);
  if (existing) {
    return { ...leaf, activePath: tab.path };
  }
  return {
    ...leaf,
    tabs: [...leaf.tabs, tab],
    activePath: tab.path,
  };
}

export function closeTabInLeaf(leaf: LeafPane, path: string): LeafPane {
  const idx = leaf.tabs.findIndex((t) => t.path === path);
  if (idx === -1) return leaf;
  const tabs = leaf.tabs.filter((t) => t.path !== path);
  let activePath = leaf.activePath;
  if (activePath === path) {
    if (tabs.length === 0) activePath = "";
    else activePath = tabs[Math.min(idx, tabs.length - 1)].path;
  }
  return { ...leaf, tabs, activePath };
}

/**
 * Remove uma tab da árvore inteira. Se o leaf que continha a tab ficar vazio E
 * tiver um irmão (estiver dentro de um split), o split é colapsado para o
 * irmão. Retorna a nova root e o id do leaf que deve receber o foco (ou null).
 */
export function closeTabInTree(
  root: PaneNode,
  paneId: PaneId,
  path: string,
): { root: PaneNode; focusId: PaneId | null } {
  const updated = updateLeaf(root, paneId, (leaf) => closeTabInLeaf(leaf, path));
  // Colapsa leafs vazios (exceto se for a única root)
  return collapseEmptyLeaves(updated);
}

function collapseEmptyLeaves(root: PaneNode): { root: PaneNode; focusId: PaneId | null } {
  let focusId: PaneId | null = null;

  function visit(node: PaneNode): PaneNode {
    if (node.kind === "leaf") return node;
    const a = visit(node.a);
    const b = visit(node.b);
    const aEmpty = a.kind === "leaf" && a.tabs.length === 0;
    const bEmpty = b.kind === "leaf" && b.tabs.length === 0;
    if (aEmpty && bEmpty) {
      // Mantém um único leaf vazio para preservar o foco
      focusId = a.id;
      return a;
    }
    if (aEmpty) {
      // promove b
      const promoted = b;
      if (promoted.kind === "leaf") focusId = promoted.id;
      return promoted;
    }
    if (bEmpty) {
      const promoted = a;
      if (promoted.kind === "leaf") focusId = promoted.id;
      return promoted;
    }
    if (a !== node.a || b !== node.b) return { ...node, a, b };
    return node;
  }

  const next = visit(root);
  return { root: next, focusId };
}

// ── Splits ───────────────────────────────────────────────────────────────────

/**
 * Faz split do leaf identificado por `targetLeafId`, criando um novo leaf com a
 * tab `tab` no lado indicado. Retorna a nova root e o id do leaf novo.
 */
export function splitLeafAtSide(
  root: PaneNode,
  targetLeafId: PaneId,
  side: Exclude<DropSide, "center">,
  tab: PaneTab,
): { root: PaneNode; newLeafId: PaneId } {
  const newLeaf: LeafPane = {
    kind: "leaf",
    id: newPaneId(),
    tabs: [tab],
    activePath: tab.path,
  };
  const direction: SplitPane["direction"] =
    side === "left" || side === "right" ? "horizontal" : "vertical";

  const next = mapNode(root, (n) => {
    if (n.kind !== "leaf" || n.id !== targetLeafId) return n;
    const split: SplitPane = {
      kind: "split",
      id: newPaneId(),
      direction,
      size: 50,
      a: side === "left" || side === "top" ? newLeaf : n,
      b: side === "left" || side === "top" ? n : newLeaf,
    };
    return split;
  });

  return { root: next, newLeafId: newLeaf.id };
}

/**
 * Move uma tab existente entre leafs (ou abre nova). Se já existir um leaf que
 * contém a tab, ela é movida; caso contrário, é aberta como nova.
 */
export function openOrMoveTab(
  root: PaneNode,
  targetLeafId: PaneId,
  tab: PaneTab,
  side: DropSide,
): { root: PaneNode; focusId: PaneId } {
  if (side === "center") {
    const next = updateLeaf(root, targetLeafId, (leaf) => openTabInLeaf(leaf, tab));
    return { root: next, focusId: targetLeafId };
  }
  const result = splitLeafAtSide(root, targetLeafId, side, tab);
  return { root: result.root, focusId: result.newLeafId };
}

// ── Atualização de conteúdo ──────────────────────────────────────────────────

export function updateTabContent(
  root: PaneNode,
  path: string,
  content: string,
  dirty: boolean,
): PaneNode {
  return updateAllLeaves(root, (leaf) => {
    if (!leaf.tabs.some((t) => t.path === path)) return leaf;
    return {
      ...leaf,
      tabs: leaf.tabs.map((t) => (t.path === path ? { ...t, content, dirty } : t)),
    };
  });
}

export function setTabClean(root: PaneNode, path: string): PaneNode {
  return updateAllLeaves(root, (leaf) => {
    if (!leaf.tabs.some((t) => t.path === path)) return leaf;
    return {
      ...leaf,
      tabs: leaf.tabs.map((t) => (t.path === path ? { ...t, dirty: false } : t)),
    };
  });
}

/** Reordena tabs dentro de um leaf. */
export function reorderTabsInLeaf(
  root: PaneNode,
  paneId: PaneId,
  fromIndex: number,
  toIndex: number,
): PaneNode {
  return updateLeaf(root, paneId, (leaf) => {
    const tabs = [...leaf.tabs];
    const [moved] = tabs.splice(fromIndex, 1);
    if (!moved) return leaf;
    tabs.splice(toIndex, 0, moved);
    return { ...leaf, tabs };
  });
}

// ── Serialização (sessão) ────────────────────────────────────────────────────

export type SerializedTab = { path: string };
export type SerializedLeaf = {
  kind: "leaf";
  id: PaneId;
  tabs: SerializedTab[];
  activePath: string;
};
export type SerializedSplit = {
  kind: "split";
  id: PaneId;
  direction: "horizontal" | "vertical";
  size: number;
  a: SerializedNode;
  b: SerializedNode;
};
export type SerializedNode = SerializedLeaf | SerializedSplit;

export function serializePane(node: PaneNode): SerializedNode {
  if (node.kind === "leaf") {
    return {
      kind: "leaf",
      id: node.id,
      tabs: node.tabs.map((t) => ({ path: t.path })),
      activePath: node.activePath,
    };
  }
  return {
    kind: "split",
    id: node.id,
    direction: node.direction,
    size: node.size,
    a: serializePane(node.a),
    b: serializePane(node.b),
  };
}

/**
 * Reconstrói árvore a partir do snapshot, lendo conteúdo via `readFile`.
 * Tabs cujo readFile falha são silenciosamente descartados.
 */
export async function deserializePane(
  s: SerializedNode,
  readFile: (path: string) => Promise<string>,
): Promise<PaneNode> {
  if (s.kind === "leaf") {
    const results = await Promise.all(
      s.tabs.map(async (t) => {
        try {
          const content = await readFile(t.path);
          return { path: t.path, content, dirty: false } as PaneTab;
        } catch {
          return null;
        }
      }),
    );
    const tabs = results.filter((t): t is PaneTab => t !== null);
    const activePath = tabs.some((t) => t.path === s.activePath)
      ? s.activePath
      : (tabs[0]?.path ?? "");
    return { kind: "leaf", id: s.id, tabs, activePath };
  }
  const [a, b] = await Promise.all([
    deserializePane(s.a, readFile),
    deserializePane(s.b, readFile),
  ]);
  return { kind: "split", id: s.id, direction: s.direction, size: s.size, a, b };
}

/** Atualiza `size` de um split node (0..100, refere-se ao filho `a`). */
export function setSplitSize(root: PaneNode, splitId: PaneId, size: number): PaneNode {
  return mapNode(root, (n) => (n.kind === "split" && n.id === splitId ? { ...n, size } : n));
}

/** Lista de paths de todas as tabs (para sessão). */
export function getAllOpenPaths(root: PaneNode): string[] {
  const out: string[] = [];
  for (const leaf of getAllLeaves(root)) {
    for (const tab of leaf.tabs) {
      if (!out.includes(tab.path)) out.push(tab.path);
    }
  }
  return out;
}
