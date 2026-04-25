import { bench, describe } from "vitest";
import {
  type LeafPane,
  type PaneNode,
  type PaneTab,
  closeTabInTree,
  emptyLeaf,
  findLeafWithPath,
  getAllLeaves,
  openOrMoveTab,
  openTabInLeaf,
  splitLeafAtSide,
  updateTabContent,
} from "../features/editor/panes";

function makeTab(i: number): PaneTab {
  return { path: `/tmp/file_${i}.ts`, content: `// file ${i}\n`, dirty: false };
}

function leafWithTabs(n: number): LeafPane {
  let leaf = emptyLeaf();
  for (let i = 0; i < n; i++) {
    leaf = openTabInLeaf(leaf, makeTab(i));
  }
  return leaf;
}

function deepSplitTree(depth: number): PaneNode {
  let root: PaneNode = leafWithTabs(5);
  for (let i = 0; i < depth; i++) {
    const leaves = getAllLeaves(root);
    const target = leaves[leaves.length - 1];
    const result = splitLeafAtSide(
      root,
      target.id,
      i % 2 === 0 ? "right" : "bottom",
      makeTab(1000 + i),
    );
    root = result.root;
  }
  return root;
}

describe("panes — openTabInLeaf", () => {
  const leaf10 = leafWithTabs(10);
  const leaf50 = leafWithTabs(50);

  bench("open new tab in leaf with 10 tabs", () => {
    openTabInLeaf(leaf10, makeTab(9999));
  });

  bench("open new tab in leaf with 50 tabs", () => {
    openTabInLeaf(leaf50, makeTab(9999));
  });

  bench("re-activate existing tab (50 tabs)", () => {
    openTabInLeaf(leaf50, makeTab(25));
  });
});

describe("panes — closeTabInTree", () => {
  const flat = leafWithTabs(50);
  const tree8 = deepSplitTree(8);
  const tree16 = deepSplitTree(16);

  bench("close tab in flat leaf (50 tabs)", () => {
    closeTabInTree(flat, flat.id, "/tmp/file_25.ts");
  });

  bench("close tab in tree depth 8", () => {
    const leaves = getAllLeaves(tree8);
    const target = leaves[0];
    closeTabInTree(tree8, target.id, target.tabs[0].path);
  });

  bench("close tab in tree depth 16", () => {
    const leaves = getAllLeaves(tree16);
    const target = leaves[0];
    closeTabInTree(tree16, target.id, target.tabs[0].path);
  });
});

describe("panes — traversal", () => {
  const tree16 = deepSplitTree(16);
  const tree32 = deepSplitTree(32);

  bench("getAllLeaves depth 16", () => {
    getAllLeaves(tree16);
  });

  bench("getAllLeaves depth 32", () => {
    getAllLeaves(tree32);
  });

  bench("findLeafWithPath depth 32 (last leaf)", () => {
    findLeafWithPath(tree32, "/tmp/file_1031.ts");
  });

  bench("findLeafWithPath depth 32 (miss)", () => {
    findLeafWithPath(tree32, "/tmp/nonexistent.ts");
  });
});

describe("panes — updateTabContent", () => {
  const tree16 = deepSplitTree(16);

  bench("updateTabContent depth 16 (hit)", () => {
    updateTabContent(tree16, "/tmp/file_0.ts", "new content", true);
  });

  bench("updateTabContent depth 16 (miss)", () => {
    updateTabContent(tree16, "/tmp/nonexistent.ts", "x", true);
  });
});

describe("panes — splits", () => {
  const tree8 = deepSplitTree(8);

  bench("splitLeafAtSide on tree depth 8", () => {
    const leaves = getAllLeaves(tree8);
    splitLeafAtSide(tree8, leaves[0].id, "right", makeTab(99999));
  });

  bench("openOrMoveTab center on depth 8", () => {
    const leaves = getAllLeaves(tree8);
    openOrMoveTab(tree8, leaves[0].id, makeTab(99999), "center");
  });
});
