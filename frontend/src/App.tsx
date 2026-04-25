import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ShortcutHud, type ShortcutHint } from "@/components/ShortcutHud";
import { Sidebar } from "@/components/Sidebar";
import { Toaster } from "@/components/ui/toaster";
import { type EditorMarker, ProblemsPanel } from "@/features/editor/ProblemsPanel";
import { ThemePicker } from "@/features/editor/ThemePicker";
import { QuickOpen } from "@/features/editor/QuickOpen";
import { PaneTree, type DraggedFile } from "@/features/editor/PaneTree";
import { webviewPathFromUrl, isWebviewPath } from "@/features/editor/WebView";
import {
  closeTabInTree,
  deserializePane,
  emptyLeaf,
  findLeafById,
  findLeafWithPath,
  getAllLeaves,
  getAllOpenPaths,
  openOrMoveTab,
  openTabInLeaf,
  reorderTabsInLeaf,
  serializePane,
  setSplitSize,
  setTabClean,
  updateLeaf,
  updateTabContent,
  type DropSide,
  type PaneId,
  type PaneNode,
} from "@/features/editor/panes";
import { rpc as gitRpc } from "@/features/git/rpc";
import { Notifications } from "@/features/notifications/Notifications";
import { StatusBar } from "@/features/statusbar/StatusBar";
import { TopBar } from "@/features/topbar/TopBar";
import { WelcomePage } from "@/features/welcome/WelcomePage";
import { useConfig } from "@/hooks/useConfig";
import { useRecentFolders } from "@/hooks/useRecentFolders";
import { useTheme } from "@/hooks/useTheme";
import { loadSession, saveSession } from "@/hooks/useSession";
import "@/index.css";
import {
  GetInitialPath,
  ListDir,
  OpenFolderDialog,
  ReadFile,
  WatchRoot,
  WriteFile,
} from "../wailsjs/go/main/App";
import { SetWorkdir as cmdSetWorkdir } from "../wailsjs/go/main/CommandCenter";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { BookOpen, X } from "lucide-react";
import { EventsEmit, EventsOn } from "../wailsjs/runtime/runtime";

const TerminalPanel = lazy(() =>
  import("@/features/terminal/TerminalPanel").then((m) => ({ default: m.TerminalPanel })),
);
const CommandPalette = lazy(() =>
  import("@/features/command-palette/CommandPalette").then((m) => ({ default: m.CommandPalette })),
);
const SettingsView = lazy(() =>
  import("@/features/settings/SettingsView").then((m) => ({ default: m.SettingsView })),
);
const AboutView = lazy(() =>
  import("@/features/about/AboutView").then((m) => ({ default: m.AboutView })),
);
const OnboardingView = lazy(() =>
  import("@/features/onboarding/OnboardingView").then((m) => ({ default: m.OnboardingView })),
);
const GitView = lazy(() => import("@/features/git/GitView").then((m) => ({ default: m.GitView })));
const KeybindingsView = lazy(() =>
  import("@/features/keybindings/KeybindingsView").then((m) => ({ default: m.KeybindingsView })),
);
const BenchView = lazy(() =>
  import("@/features/bench/BenchView").then((m) => ({ default: m.BenchView })),
);
const MarkdownPreview = lazy(() =>
  import("@/features/editor/MarkdownPreview").then((m) => ({ default: m.MarkdownPreview })),
);
const PatchDiff = lazy(() => import("@pierre/diffs/react").then((m) => ({ default: m.PatchDiff })));

function ViewFallback() {
  return (
    <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">
      Carregando…
    </div>
  );
}

type Entry = { name: string; path: string; isDir: boolean };
type View = "editor" | "settings" | "about" | "onboarding" | "git" | "keybindings" | "bench";
type BottomPanel = "terminal" | "problems" | "diff";

function SettingsOverlay({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 bg-background">
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar configurações"
        className="absolute right-4 top-4 z-10 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <X className="size-4" />
      </button>
      <Suspense fallback={<ViewFallback />}>
        <SettingsView />
      </Suspense>
    </div>
  );
}

function App() {
  const [rootPath, setRootPath] = useState<string>("");
  const [rootEntries, setRootEntries] = useState<Entry[]>([]);
  const [rootPane, setRootPane] = useState<PaneNode>(() => emptyLeaf());
  const [focusedPaneId, setFocusedPaneId] = useState<PaneId>(() => (rootPane as { id: PaneId }).id);
  const [bottomPanel, setBottomPanel] = useState<BottomPanel | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState<boolean>(false);
  const [view, setView] = useState<View>("editor");
  const [recentPaths, setRecentPaths] = useState<string[]>([]);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [branch, setBranch] = useState("");
  const [markers, setMarkers] = useState<Record<string, EditorMarker[]>>({});
  const [quickOpenOpen, setQuickOpenOpen] = useState(false);
  const [markdownPreviewOpen, setMarkdownPreviewOpen] = useState(false);
  const [diffPatch, setDiffPatch] = useState<string | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const { value: sidebarLocation } = useConfig<"left" | "right">(
    "workbench.sideBar.location",
    "left",
  );
  const { value: zenMode, set: setZenMode } = useConfig<boolean>("workbench.zenMode", false);
  const { value: autoSave } = useConfig<string>("editor.autoSave", "off");
  const { value: autoSaveDelay } = useConfig<number>("editor.autoSaveDelay", 1000);
  const { value: zoomLevel } = useConfig<number>("window.zoomLevel", 0);

  useEffect(() => {
    const z = typeof zoomLevel === "number" ? zoomLevel : 0;
    document.documentElement.style.fontSize = `${100 + z * 10}%`;
    return () => {
      document.documentElement.style.fontSize = "";
    };
  }, [zoomLevel]);

  // Zen mode só faz sentido com pasta aberta — desativa no welcome
  // para evitar abrir o app numa tela "vazia" sem topbar/statusbar.
  useEffect(() => {
    if (!rootPath && zenMode) void setZenMode(false);
  }, [rootPath, zenMode, setZenMode]);
  const {
    folders: recentFolders,
    push: pushRecentFolder,
    remove: removeRecentFolder,
  } = useRecentFolders();
  useTheme();
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const [shortcutHint, setShortcutHint] = useState<ShortcutHint | null>(null);
  const hintIdRef = useRef(0);
  const showHint = useCallback((label: string) => {
    hintIdRef.current += 1;
    setShortcutHint({ label, id: hintIdRef.current });
  }, []);

  const focusedLeaf = useMemo(
    () => findLeafById(rootPane, focusedPaneId),
    [rootPane, focusedPaneId],
  );
  const activeTab = useMemo(
    () => focusedLeaf?.tabs.find((t) => t.path === focusedLeaf.activePath),
    [focusedLeaf],
  );
  const activePath = activeTab?.path ?? "";
  const openPaths = useMemo(() => getAllOpenPaths(rootPane), [rootPane]);

  // Refs para auto-save sem stale closure
  const rootPaneRef = useRef(rootPane);
  useEffect(() => {
    rootPaneRef.current = rootPane;
  });
  const focusedPaneIdRef = useRef(focusedPaneId);
  useEffect(() => {
    focusedPaneIdRef.current = focusedPaneId;
  }, [focusedPaneId]);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setCursorPos({ line: 1, col: 1 });
  }, [activePath]);

  // Restaura sessão salva ao iniciar — CLI path tem prioridade sobre sessão
  useEffect(() => {
    void (async () => {
      const cliPath = await GetInitialPath().catch(() => "");
      if (cliPath) {
        await openFolderRef.current(cliPath);
        return;
      }
      const session = await loadSession();
      if (!session?.rootPath) return;
      await openFolderRef.current(session.rootPath);

      if (session.paneTree) {
        // novo formato: reconstrói layout completo
        const tree = await deserializePane(session.paneTree, ReadFile);
        setRootPane(tree);
        // foco: se o id salvo ainda existe, usa-o; senão, primeiro leaf com tabs
        const leaves = getAllLeaves(tree);
        const focusable =
          (session.focusedPaneId && leaves.find((l) => l.id === session.focusedPaneId)) ||
          leaves.find((l) => l.tabs.length > 0) ||
          leaves[0];
        if (focusable) setFocusedPaneId(focusable.id);
        return;
      }

      // legado: lista plana de arquivos
      for (const filePath of session.openFiles) {
        await openFileRef.current({
          name: filePath.split("/").pop() ?? filePath,
          path: filePath,
          isDir: false,
        });
      }
      if (session.activePath) {
        setRootPane((prev) => {
          const leaf = findLeafWithPath(prev, session.activePath);
          if (!leaf) return prev;
          return updateLeaf(prev, leaf.id, (l) => ({ ...l, activePath: session.activePath }));
        });
      }
    })();
  }, []);

  // Persiste sessão com debounce ao mudar rootPath/rootPane/foco
  useEffect(() => {
    if (!rootPath) return;
    if (sessionSaveTimerRef.current) clearTimeout(sessionSaveTimerRef.current);
    sessionSaveTimerRef.current = setTimeout(() => {
      void saveSession({
        rootPath,
        openFiles: openPaths,
        activePath,
        paneTree: serializePane(rootPane),
        focusedPaneId,
      });
    }, 500);
  }, [rootPath, rootPane, openPaths, activePath, focusedPaneId]);

  useEffect(() => {
    return gitRpc.on("git.branch", (b: unknown) => {
      if (typeof b === "string") setBranch(b);
    });
  }, []);

  const openFolder = async (folderPath?: string) => {
    try {
      const path =
        typeof folderPath === "string" && folderPath ? folderPath : await OpenFolderDialog();
      if (!path) return;
      setRootPath(path);
      gitRpc.git.setWorkdir(path);
      void cmdSetWorkdir(path);
      const entries = await ListDir(path);
      setRootEntries(entries || []);
      void pushRecentFolder(path);
      void WatchRoot(path);
    } catch (e) {
      console.error(e);
    }
  };

  const trackRecent = (path: string) =>
    setRecentPaths((prev) => [path, ...prev.filter((p) => p !== path)].slice(0, 30));

  const openUrl = (rawUrl: string) => {
    const url = rawUrl.trim();
    if (!url) return;
    const path = webviewPathFromUrl(
      /^https?:\/\//i.test(url)
        ? url
        : /^localhost(:\d+)?(\/|$)/i.test(url) || url.startsWith("127.0.0.1")
          ? `http://${url}`
          : `https://${url}`,
    );
    const existingLeaf = findLeafWithPath(rootPaneRef.current, path);
    if (existingLeaf) {
      setRootPane((prev) => updateLeaf(prev, existingLeaf.id, (l) => ({ ...l, activePath: path })));
      setFocusedPaneId(existingLeaf.id);
      return;
    }
    const tab = { path, content: "", dirty: false };
    setRootPane((prev) => {
      const targetId = findLeafById(prev, focusedPaneId)
        ? focusedPaneId
        : (prev as { id: PaneId }).id;
      return updateLeaf(prev, targetId, (l) => openTabInLeaf(l, tab));
    });
  };

  const onWebviewNavigate = (paneId: PaneId, oldPath: string, newPath: string) => {
    if (oldPath === newPath) return;
    setRootPane((prev) =>
      updateLeaf(prev, paneId, (l) => {
        const idx = l.tabs.findIndex((t) => t.path === oldPath);
        if (idx === -1) return l;
        // se já há outra tab com o newPath neste leaf, apenas foca e remove a antiga
        if (l.tabs.some((t) => t.path === newPath)) {
          return {
            ...l,
            tabs: l.tabs.filter((t) => t.path !== oldPath),
            activePath: newPath,
          };
        }
        const tabs = [...l.tabs];
        tabs[idx] = { ...tabs[idx], path: newPath };
        return {
          ...l,
          tabs,
          activePath: l.activePath === oldPath ? newPath : l.activePath,
        };
      }),
    );
  };

  const openFile = async (entry: Entry) => {
    // se já existe num leaf, apenas foca
    const existingLeaf = findLeafWithPath(rootPaneRef.current, entry.path);
    if (existingLeaf) {
      setRootPane((prev) =>
        updateLeaf(prev, existingLeaf.id, (l) => ({ ...l, activePath: entry.path })),
      );
      setFocusedPaneId(existingLeaf.id);
      trackRecent(entry.path);
      return;
    }
    try {
      const content = await ReadFile(entry.path);
      const tab = { path: entry.path, content, dirty: false };
      setRootPane((prev) => {
        const targetId = findLeafById(prev, focusedPaneId)
          ? focusedPaneId
          : (prev as { id: PaneId }).id; // fallback para root se for leaf
        return updateLeaf(prev, targetId, (l) => openTabInLeaf(l, tab));
      });
      trackRecent(entry.path);
    } catch (e) {
      console.error(e);
    }
  };

  // Atualiza o conteúdo de qualquer arquivo aberto + agenda auto-save
  const updateFile = (filePath: string, content: string) => {
    setRootPane((prev) => updateTabContent(prev, filePath, content, true));
    if (autoSave === "afterDelay") {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(async () => {
        // pega o conteúdo mais recente da árvore
        const leaf = findLeafWithPath(rootPaneRef.current, filePath);
        const tab = leaf?.tabs.find((t) => t.path === filePath);
        if (!tab?.dirty) return;
        try {
          await WriteFile(filePath, tab.content);
          setRootPane((p) => setTabClean(p, filePath));
        } catch (e) {
          console.error(e);
        }
      }, autoSaveDelay ?? 1000);
    }
  };

  const openFileRef = useRef(openFile);
  useEffect(() => {
    openFileRef.current = openFile;
  });

  const openUrlRef = useRef(openUrl);
  useEffect(() => {
    openUrlRef.current = openUrl;
  });

  const setViewRef = useRef(setView);
  useEffect(() => {
    setViewRef.current = setView;
  });

  const openFolderRef = useRef(openFolder);
  useEffect(() => {
    openFolderRef.current = openFolder;
  });

  const zenModeRef = useRef(zenMode as boolean);
  useEffect(() => {
    zenModeRef.current = zenMode as boolean;
  }, [zenMode]);
  const setZenModeRef = useRef(setZenMode);
  useEffect(() => {
    setZenModeRef.current = setZenMode;
  });
  const chordRef = useRef<string | null>(null);

  const refreshRoot = useCallback(async () => {
    if (!rootPath) return;
    try {
      const entries = await ListDir(rootPath);
      setRootEntries((entries as Entry[]) || []);
    } catch (e) {
      console.error(e);
    }
  }, [rootPath]);

  const refreshRootRef = useRef(refreshRoot);
  useEffect(() => {
    refreshRootRef.current = refreshRoot;
  });

  // Evento do file watcher Go → atualiza árvore
  useEffect(() => {
    return EventsOn("fileTree.changed", () => void refreshRootRef.current());
  }, []);

  // Escuta evento do Go: Config.OpenSettingsJson() emite "editor.openFile".
  useEffect(() => {
    return EventsOn("editor.openFile", (path: unknown) => {
      if (typeof path !== "string") return;
      openFileRef.current({ name: path.split("/").pop() ?? path, path, isDir: false });
    });
  }, []);

  // Escuta comandos emitidos pelo CommandCenter.Execute() no Go.
  useEffect(() => {
    return EventsOn("commandCenter.exec", (id: unknown) => {
      switch (id) {
        case "openFolder":
          void openFolderRef.current();
          break;
        case "toggleTerminal":
          setBottomPanel((p) => (p === "terminal" ? null : "terminal"));
          break;
        case "openSettings":
          setViewRef.current("settings");
          break;
        case "openKeybindings":
          setViewRef.current("keybindings");
          break;
        case "openGitView":
          setViewRef.current("git");
          break;
        case "openBenchView":
          setViewRef.current("bench");
          break;
        case "openOnboarding":
          setViewRef.current("onboarding");
          break;
        case "openAbout":
          setViewRef.current("about");
          break;
        case "toggleZen":
          void setZenModeRef.current(!zenModeRef.current);
          break;
        case "openWebview":
          {
            const url = window.prompt(
              "URL para abrir como aba (ex: http://localhost:5173)",
              "http://localhost:5173",
            );
            if (url) openUrlRef.current(url);
          }
          break;
      }
    });
  }, []);

  const onCloseTab = (paneId: PaneId, path: string) => {
    const result = closeTabInTree(rootPaneRef.current, paneId, path);
    setRootPane(result.root);
    if (result.focusId) setFocusedPaneId(result.focusId);
    setMarkers((m) => {
      const { [path]: _, ...rest } = m;
      return rest;
    });
  };

  const onActivateTab = (paneId: PaneId, path: string) => {
    setRootPane((prev) => updateLeaf(prev, paneId, (l) => ({ ...l, activePath: path })));
    setFocusedPaneId(paneId);
    if (!isWebviewPath(path)) trackRecent(path);
  };

  const onReorderTabs = (paneId: PaneId, fromIndex: number, toIndex: number) => {
    setRootPane((prev) => reorderTabsInLeaf(prev, paneId, fromIndex, toIndex));
  };

  const onDropFile = async (paneId: PaneId, side: DropSide, file: DraggedFile) => {
    // no-op: arrastar tab pra ele mesmo no centro
    if (file.fromPaneId && file.fromPaneId === paneId && side === "center") return;

    // se o arquivo já está aberto em algum leaf, reaproveita o tab existente
    const existingLeaf = findLeafWithPath(rootPaneRef.current, file.path);
    let tab = existingLeaf?.tabs.find((t) => t.path === file.path);
    if (!tab) {
      try {
        const content = await ReadFile(file.path);
        tab = { path: file.path, content, dirty: false };
      } catch (e) {
        console.error(e);
        return;
      }
    }
    setRootPane((prev) => {
      const opened = openOrMoveTab(prev, paneId, tab!, side);
      let next = opened.root;
      let focusId = opened.focusId;
      // se veio de outro pane (drag de tab), remove do leaf de origem
      if (file.fromPaneId && file.fromPaneId !== focusId) {
        const closed = closeTabInTree(next, file.fromPaneId, file.path);
        next = closed.root;
        // se o leaf focado virou outro depois do collapse, mantém o do open
        if (!findLeafById(next, focusId) && closed.focusId) focusId = closed.focusId;
      }
      setFocusedPaneId(focusId);
      return next;
    });
    trackRecent(file.path);
  };

  const splitActiveTab = useCallback((side: Exclude<DropSide, "center">) => {
    const focusId = focusedPaneIdRef.current;
    const leaf = findLeafById(rootPaneRef.current, focusId);
    const tab = leaf?.tabs.find((t) => t.path === leaf.activePath);
    if (!leaf || !tab) return;
    setRootPane((prev) => {
      const result = openOrMoveTab(prev, focusId, tab, side);
      setFocusedPaneId(result.focusId);
      return result.root;
    });
  }, []);

  const closeActiveTab = useCallback(() => {
    const focusId = focusedPaneIdRef.current;
    const leaf = findLeafById(rootPaneRef.current, focusId);
    if (!leaf || !leaf.activePath) return;
    onCloseTab(focusId, leaf.activePath);
  }, []);

  const focusNthLeaf = useCallback((n: number) => {
    const leaves = getAllLeaves(rootPaneRef.current);
    const target = leaves[n];
    if (target) setFocusedPaneId(target.id);
  }, []);

  const saveActive = useCallback(async () => {
    const path = activePath;
    if (!path || isWebviewPath(path)) return;
    const leaf = findLeafWithPath(rootPaneRef.current, path);
    const tab = leaf?.tabs.find((t) => t.path === path);
    if (!tab) return;
    try {
      await WriteFile(tab.path, tab.content);
      setRootPane((p) => setTabClean(p, path));
    } catch (e) {
      console.error(e);
    }
  }, [activePath]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.ctrlKey || e.metaKey;

      // Chord: aguardando segunda tecla após Ctrl+K
      if (chordRef.current === "k") {
        chordRef.current = null;
        if (e.key.toLowerCase() === "z") {
          e.preventDefault();
          showHint("Ctrl + K + Z");
          void setZenMode(!zenModeRef.current);
          return;
        }
        if (e.key.toLowerCase() === "o") {
          e.preventDefault();
          showHint("Ctrl + K + O");
          void openFolderRef.current();
          return;
        }
        if (e.key.toLowerCase() === "t") {
          e.preventDefault();
          showHint("Ctrl + K + T");
          setThemePickerOpen(true);
          return;
        }
        if (e.key === "\\") {
          e.preventDefault();
          showHint("Ctrl + K + \\");
          splitActiveTab("bottom");
          return;
        }
      }

      if (meta && !e.shiftKey && !e.altKey && e.key === "\\") {
        e.preventDefault();
        showHint("Ctrl + \\");
        splitActiveTab("right");
        return;
      }
      if (meta && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "w") {
        e.preventDefault();
        showHint("Ctrl + W");
        closeActiveTab();
        return;
      }
      if (meta && !e.shiftKey && !e.altKey && /^[1-9]$/.test(e.key)) {
        e.preventDefault();
        showHint(`Ctrl + ${e.key}`);
        focusNthLeaf(Number(e.key) - 1);
        return;
      }

      if (meta && e.shiftKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        showHint("Ctrl + Shift + O");
        EventsEmit("editor.gotoSymbol");
        return;
      }
      if (meta && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        showHint("Ctrl + P");
        setQuickOpenOpen(true);
        return;
      }
      if (meta && e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        showHint("Ctrl + Shift + P");
        setPaletteOpen(true);
        return;
      }
      if (meta && e.shiftKey && e.key.toLowerCase() === "m") {
        e.preventDefault();
        showHint("Ctrl + Shift + M");
        setBottomPanel((p) => (p === "problems" ? null : "problems"));
        return;
      }
      if (meta && e.shiftKey && e.key.toLowerCase() === "u") {
        e.preventDefault();
        showHint("Ctrl + Shift + U");
        const url = window.prompt(
          "URL para abrir como aba (ex: http://localhost:5173)",
          "http://localhost:5173",
        );
        if (url) openUrlRef.current(url);
        return;
      }
      if (meta && e.key.toLowerCase() === "s") {
        e.preventDefault();
        showHint("Ctrl + S");
        saveActive();
        return;
      }
      if (meta && e.key === "`") {
        e.preventDefault();
        showHint("Ctrl + `");
        setBottomPanel((p) => (p === "terminal" ? null : "terminal"));
        return;
      }
      if (meta && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "j") {
        e.preventDefault();
        showHint("Ctrl + J");
        setBottomPanel((p) => (p === "terminal" ? null : "terminal"));
        return;
      }
      if (meta && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "b") {
        e.preventDefault();
        showHint("Ctrl + B");
        setSidebarVisible((v) => !v);
        return;
      }
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        showHint("Ctrl + K");
        chordRef.current = "k";
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [saveActive, setZenMode, showHint, splitActiveTab, closeActiveTab, focusNthLeaf]);

  const allMarkers = Object.values(markers).flat();
  const errorCount = allMarkers.filter((m) => m.severity === 8).length;
  const warningCount = allMarkers.filter((m) => m.severity === 4).length;

  const onMarkersChange = useCallback((filePath: string, fileMarkers: EditorMarker[]) => {
    setMarkers((m) => ({ ...m, [filePath]: fileMarkers }));
  }, []);

  const isMarkdown = /\.(md|mdx)$/i.test(activeTab?.path ?? "");

  // Carrega diff quando o painel de diff abre ou o arquivo ativo muda
  useEffect(() => {
    if (bottomPanel !== "diff" || !activePath) {
      setDiffPatch(null);
      return;
    }
    setDiffLoading(true);
    gitRpc.git
      .diff(activePath, false)
      .then((p) => setDiffPatch(p as string))
      .catch(() => setDiffPatch(null))
      .finally(() => setDiffLoading(false));
  }, [bottomPanel, activePath]);

  // Painel inferior: terminal + problemas + diff com aba de seleção
  const bottomPanelEl = bottomPanel !== null && (
    <>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize="30%" minSize="15%">
        <div className="flex flex-col h-full overflow-hidden">
          {/* Aba seletora */}
          <div className="flex items-center border-b shrink-0 text-xs bg-muted/20">
            {(["terminal", "problems", "diff"] as BottomPanel[]).map((panel) => (
              <button
                key={panel}
                onClick={() => setBottomPanel(panel)}
                className={
                  "px-3 py-1.5 border-b-2 transition-colors flex items-center gap-1.5 " +
                  (bottomPanel === panel
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground")
                }
              >
                {panel === "terminal" ? (
                  "Terminal"
                ) : panel === "diff" ? (
                  "Diff"
                ) : (
                  <>
                    Problemas
                    {errorCount > 0 && <span className="text-destructive">{errorCount}</span>}
                    {warningCount > 0 && <span className="text-amber-500">{warningCount}</span>}
                  </>
                )}
              </button>
            ))}
            <div className="flex-1" />
            <button
              onClick={() => setBottomPanel(null)}
              className="px-2 py-1 text-muted-foreground hover:text-foreground"
              aria-label="Fechar painel"
            >
              <X className="size-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-hidden min-h-0">
            {/* Terminal: mantido montado para preservar sessão PTY */}
            <div
              style={{
                display: bottomPanel === "terminal" ? "flex" : "none",
                height: "100%",
                flexDirection: "column",
              }}
            >
              <Suspense fallback={<ViewFallback />}>
                <TerminalPanel
                  defaultCwd={rootPath || undefined}
                  onClose={() => setBottomPanel(null)}
                  onFileLink={(path, line) => {
                    openFile({ name: path.split("/").pop() ?? path, path, isDir: false });
                    console.log("link:", path, line);
                  }}
                />
              </Suspense>
            </div>

            {bottomPanel === "problems" && (
              <ProblemsPanel
                markers={markers}
                rootPath={rootPath}
                onNavigate={(path, line, col) => {
                  openFile({ name: path.split("/").pop() ?? path, path, isDir: false });
                  setTimeout(() => EventsEmit("editor.gotoLine", { line, column: col }), 50);
                }}
              />
            )}

            {bottomPanel === "diff" && (
              <div className="h-full overflow-auto">
                {diffLoading ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    Carregando diff…
                  </div>
                ) : diffPatch ? (
                  <Suspense fallback={<ViewFallback />}>
                    <PatchDiff
                      patch={diffPatch}
                      options={{ diffIndicators: "bars", lineDiffType: "word", overflow: "scroll" }}
                      style={{ height: "100%" }}
                    />
                  </Suspense>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    {activePath ? "Nenhuma mudança no arquivo atual." : "Selecione um arquivo."}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </ResizablePanel>
    </>
  );

  const openFileByPath = (p: string) =>
    openFileRef.current({ name: p.split("/").pop() ?? p, path: p, isDir: false });

  const welcomeEl = (
    <WelcomePage
      onOpenFolder={openFolder}
      onOpenSettings={() => setView("settings")}
      onOpenKeybindings={() => setView("keybindings")}
      onOpenGit={() => setView("git")}
      onOpenOnboarding={() => setView("onboarding")}
      recentFolders={recentFolders}
      onOpenRecentFolder={(path) => openFolder(path)}
      onRemoveRecentFolder={removeRecentFolder}
    />
  );

  // PaneTree controla todo o editor (split via drag-and-drop)
  const paneTreeEl = (
    <PaneTree
      root={rootPane}
      rootPath={rootPath}
      focusedPaneId={focusedPaneId}
      onFocusPane={setFocusedPaneId}
      onActivateTab={onActivateTab}
      onCloseTab={onCloseTab}
      onReorderTabs={onReorderTabs}
      onChange={updateFile}
      onCursorChange={(line, col) => setCursorPos({ line, col })}
      onMarkersChange={onMarkersChange}
      onDropFile={onDropFile}
      onSplitSizeChange={(splitId, size) =>
        setRootPane((prev) => setSplitSize(prev, splitId, size))
      }
      onOpenFileByPath={openFileByPath}
      onWebviewNavigate={onWebviewNavigate}
      emptyState={welcomeEl}
    />
  );

  // Quando markdown preview está aberto, abre painel à direita com o preview do tab focado
  const editorArea = (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      {activeTab && isMarkdown && markdownPreviewOpen ? (
        <ResizablePanelGroup orientation="horizontal" className="flex-1 min-h-0">
          <ResizablePanel className="flex flex-col overflow-hidden">{paneTreeEl}</ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel className="overflow-hidden">
            <Suspense fallback={<ViewFallback />}>
              <MarkdownPreview content={activeTab.content} />
            </Suspense>
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        paneTreeEl
      )}
    </div>
  );

  const sidebarPanel = (
    <ResizablePanel key="sidebar" defaultSize="18%" minSize="10%" maxSize="40%">
      <aside
        className={`h-full overflow-hidden ${sidebarLocation === "right" ? "border-l" : "border-r"}`}
      >
        <Sidebar
          rootPath={rootPath}
          files={{
            rootPath,
            rootEntries: rootEntries as Entry[],
            onOpenFile: openFile,
            onRefresh: refreshRoot,
            recentPaths,
          }}
          onOpenFile={openFile}
          onGotoLine={(_path, line, column) => {
            setTimeout(() => EventsEmit("editor.gotoLine", { line, column }), 50);
          }}
        />
      </aside>
    </ResizablePanel>
  );

  const mainPanel = (
    <ResizablePanel key="main">
      {view === "editor" || view === "settings" ? (
        <div style={{ height: "100%", overflow: "hidden" }}>
          <ResizablePanelGroup orientation="vertical">
            <ResizablePanel className="flex flex-col overflow-hidden">
              {/* Toolbar do editor: apenas botão de markdown preview */}
              {activeTab && isMarkdown && (
                <div className="flex items-center justify-end border-b shrink-0">
                  <button
                    onClick={() => setMarkdownPreviewOpen((v) => !v)}
                    className={`shrink-0 px-2 h-8 transition-colors ${
                      markdownPreviewOpen
                        ? "text-foreground bg-accent"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    }`}
                    title="Preview Markdown"
                  >
                    <BookOpen className="size-3.5" />
                  </button>
                </div>
              )}
              {editorArea}
            </ResizablePanel>
            {bottomPanelEl}
          </ResizablePanelGroup>
        </div>
      ) : (
        <div className="h-full overflow-auto relative">
          <button
            onClick={() => setView("editor")}
            aria-label="Voltar ao editor"
            className="absolute right-3 top-3 z-10 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" />
          </button>
          <Suspense fallback={<ViewFallback />}>
            {view === "about" && <AboutView />}
            {view === "onboarding" && <OnboardingView onComplete={() => setView("editor")} />}
            {view === "git" && <GitView rootPath={rootPath} />}
            {view === "keybindings" && <KeybindingsView />}
            {view === "bench" && <BenchView />}
          </Suspense>
        </div>
      )}
    </ResizablePanel>
  );

  return (
    <div
      className="w-screen overflow-hidden bg-background text-foreground"
      style={{ display: "grid", gridTemplateRows: "auto 1fr auto", height: "100vh" }}
    >
      {!zenMode && (
        <TopBar
          rootPath={rootPath}
          terminalOpen={bottomPanel === "terminal"}
          zenMode={zenMode as boolean}
          onOpenFolder={openFolder}
          onSave={saveActive}
          onCloseTab={() => activePath && focusedLeaf && onCloseTab(focusedLeaf.id, activePath)}
          onToggleTerminal={() => setBottomPanel((p) => (p === "terminal" ? null : "terminal"))}
          onSetView={setView}
          onOpenPalette={() => setPaletteOpen(true)}
          onToggleZen={() => void setZenMode(!zenModeRef.current)}
        />
      )}

      <div style={{ overflow: "hidden", minHeight: 0 }}>
        <ResizablePanelGroup orientation="horizontal" className="h-full">
          {sidebarVisible ? (
            sidebarLocation === "right" ? (
              <>
                {mainPanel}
                <ResizableHandle withHandle />
                {sidebarPanel}
              </>
            ) : (
              <>
                {sidebarPanel}
                <ResizableHandle withHandle />
                {mainPanel}
              </>
            )
          ) : (
            mainPanel
          )}
        </ResizablePanelGroup>
      </div>

      {!zenMode && (
        <StatusBar
          activeTab={activeTab}
          activeLang={activeTab ? (activeTab.path.split(".").pop()?.toLowerCase() ?? "") : ""}
          cursorLine={cursorPos.line}
          cursorCol={cursorPos.col}
          rootPath={rootPath}
          branch={branch}
          errorCount={errorCount}
          warningCount={warningCount}
          onOpenGit={() => setView("git")}
          onOpenProblems={() => setBottomPanel((p) => (p === "problems" ? null : "problems"))}
          onOpenNotifications={() => setNotificationsOpen((v) => !v)}
        />
      )}

      {paletteOpen && (
        <Suspense fallback={null}>
          <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
        </Suspense>
      )}
      <ThemePicker open={themePickerOpen} onClose={() => setThemePickerOpen(false)} />
      <QuickOpen
        open={quickOpenOpen}
        rootPath={rootPath}
        onClose={() => setQuickOpenOpen(false)}
        onOpenFile={(path) => {
          setQuickOpenOpen(false);
          void openFileRef.current({ name: path.split("/").pop() ?? path, path, isDir: false });
        }}
      />
      <ShortcutHud hint={shortcutHint} />
      <Notifications centerOpen={notificationsOpen} onCenterOpenChange={setNotificationsOpen} />
      {view === "settings" && <SettingsOverlay onClose={() => setView("editor")} />}
      <Toaster />
    </div>
  );
}

export default App;
