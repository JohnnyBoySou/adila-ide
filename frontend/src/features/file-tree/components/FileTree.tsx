import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { FileTree as FileTreeView, useFileTree, useFileTreeSearch } from "@pierre/trees/react";
import type { ContextMenuAnchorRect } from "@pierre/trees";
import {
  ArrowDownAZ,
  Bookmark,
  BookmarkMinus,
  BookmarkPlus,
  Clock,
  File as FileIcon,
  FilePlus,
  Filter,
  Folder,
  FolderOpen,
  FolderPlus,
  Pencil,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/useToast";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Spinner } from "@/components/ui/spinner";
import { rpc, type FileEntry } from "../rpc";

type BookmarkEntry = {
  abs: string;
  label: string;
  isDirectory: boolean;
};

type PersistedState = {
  bookmarks?: BookmarkEntry[];
  sortMode?: SortMode;
};

type SortMode = "name" | "mtime";

type CreateMode = { kind: "file" | "folder"; parentTreePath: string } | null;

function basename(p: string): string {
  const trimmed = p.replace(/[\\/]+$/, "");
  const slash = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  return slash === -1 ? trimmed : trimmed.slice(slash + 1);
}

function uniqueName(name: string, taken: Set<string>): string {
  if (!taken.has(name)) {
    return name;
  }
  let i = 2;
  while (taken.has(`${name}-${i}`)) {
    i++;
  }
  return `${name}-${i}`;
}

function replaceLastSegment(uri: string, newBasename: string): string {
  const slash = uri.lastIndexOf("/");
  if (slash === -1) {
    return newBasename;
  }
  return `${uri.slice(0, slash + 1)}${newBasename}`;
}

function joinUri(parent: string, childName: string): string {
  const stripped = parent.replace(/\/+$/, "");
  return `${stripped}/${childName}`;
}

function remapSet(set: Set<string>, from: string, to: string): void {
  for (const key of Array.from(set)) {
    if (key === from || key.startsWith(from)) {
      set.delete(key);
      set.add(`${to}${key.slice(from.length)}`);
    }
  }
}

function remapMap(
  map: Map<string, string>,
  from: string,
  to: string,
  fromAbs: string,
  toAbs: string,
): void {
  for (const key of Array.from(map.keys())) {
    if (key === from || key.startsWith(from)) {
      const value = map.get(key);
      if (value === undefined) {
        continue;
      }
      map.delete(key);
      const newKey = `${to}${key.slice(from.length)}`;
      const newValue = value.startsWith(fromAbs) ? `${toAbs}${value.slice(fromAbs.length)}` : value;
      map.set(newKey, newValue);
    }
  }
}

function sortEntries(list: FileEntry[], mode: SortMode): FileEntry[] {
  const copy = [...list];
  copy.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) {
      return a.isDirectory ? -1 : 1;
    }
    if (mode === "mtime") {
      const bm = b.mtime ?? 0;
      const am = a.mtime ?? 0;
      if (bm !== am) {
        return bm - am;
      }
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
  return copy;
}

export function FileTree() {
  const absByTree = useRef<Map<string, string>>(new Map());
  const knownDirs = useRef<Set<string>>(new Set());
  const loadedDirs = useRef<Set<string>>(new Set());
  const loadingDirs = useRef<Set<string>>(new Set());
  const [ready, setReady] = useState(false);
  const [rootsCount, setRootsCount] = useState(0);
  const [error, setError] = useState<string | undefined>(undefined);
  const [renderKey, setRenderKey] = useState(0);
  const [selectedTreePath, setSelectedTreePath] = useState<string | undefined>(undefined);
  const [creating, setCreating] = useState<CreateMode>(null);
  const [sortMode, setSortMode] = useState<SortMode>(() => {
    const persisted = rpc.state.get<PersistedState>();
    return persisted?.sortMode ?? "name";
  });
  const sortModeRef = useRef(sortMode);
  useEffect(() => {
    sortModeRef.current = sortMode;
  }, [sortMode]);
  const [bookmarks, setBookmarksState] = useState<BookmarkEntry[]>(() => {
    const persisted = rpc.state.get<PersistedState>();
    return persisted?.bookmarks ?? [];
  });

  const patchPersisted = useCallback((patch: Partial<PersistedState>) => {
    const prev = rpc.state.get<PersistedState>() ?? {};
    rpc.state.set<PersistedState>({ ...prev, ...patch });
  }, []);

  const persistBookmarks = useCallback(
    (next: BookmarkEntry[]) => {
      setBookmarksState(next);
      patchPersisted({ bookmarks: next });
    },
    [patchPersisted],
  );

  const addBookmark = useCallback(
    (entry: BookmarkEntry) => {
      const prev = rpc.state.get<PersistedState>()?.bookmarks ?? [];
      if (prev.some((b: BookmarkEntry) => b.abs === entry.abs)) {
        return;
      }
      persistBookmarks([...prev, entry]);
    },
    [persistBookmarks],
  );

  const removeBookmark = useCallback(
    (abs: string) => {
      const prev = rpc.state.get<PersistedState>()?.bookmarks ?? [];
      persistBookmarks(prev.filter((b: BookmarkEntry) => b.abs !== abs));
    },
    [persistBookmarks],
  );

  const bookmarkedAbsSet = useMemo(() => new Set(bookmarks.map((b) => b.abs)), [bookmarks]);

  const { model } = useFileTree({
    paths: [],
    initialExpansion: "closed",
    search: true,
    flattenEmptyDirectories: true,
    composition: {
      contextMenu: {
        enabled: true,
        triggerMode: "both",
        buttonVisibility: "when-needed",
      },
    },
    renaming: {
      onRename: (event) => {
        const fromAbs = absByTree.current.get(event.sourcePath);
        if (!fromAbs) {
          return;
        }
        const newBasename = basename(event.destinationPath);
        const toAbs = replaceLastSegment(fromAbs, newBasename);
        remapMap(absByTree.current, event.sourcePath, event.destinationPath, fromAbs, toAbs);
        remapSet(knownDirs.current, event.sourcePath, event.destinationPath);
        remapSet(loadedDirs.current, event.sourcePath, event.destinationPath);
        remapSet(loadingDirs.current, event.sourcePath, event.destinationPath);
        void rpc.fs.rename(fromAbs, toAbs).catch((err: unknown) => {
          toast.error(`Não foi possível renomear ${basename(fromAbs)}`, err);
        });
      },
      onError: (message) => {
        toast.error("Erro ao renomear", message);
      },
    },
    dragAndDrop: {
      onDropComplete: (event) => {
        const targetDir = event.target.directoryPath;
        if (!targetDir) {
          return;
        }
        const targetAbs = absByTree.current.get(targetDir);
        if (!targetAbs) {
          return;
        }
        for (const draggedPath of event.draggedPaths) {
          const fromAbs = absByTree.current.get(draggedPath);
          if (!fromAbs) {
            continue;
          }
          const isDir = draggedPath.endsWith("/");
          const name = basename(draggedPath);
          const toAbs = joinUri(targetAbs, name);
          const newTreePath = isDir ? `${targetDir}${name}/` : `${targetDir}${name}`;
          if (newTreePath === draggedPath) {
            continue;
          }
          remapMap(absByTree.current, draggedPath, newTreePath, fromAbs, toAbs);
          remapSet(knownDirs.current, draggedPath, newTreePath);
          remapSet(loadedDirs.current, draggedPath, newTreePath);
          remapSet(loadingDirs.current, draggedPath, newTreePath);
          void rpc.fs.rename(fromAbs, toAbs).catch((err: unknown) => {
            toast.error(`Não foi possível mover ${name}`, err);
          });
        }
      },
      onDropError: (message) => {
        toast.error("Erro ao mover", message);
      },
    },
    onSelectionChange: (selected) => {
      if (selected.length !== 1) {
        setSelectedTreePath(undefined);
        return;
      }
      const treePath = selected[0];
      setSelectedTreePath(treePath);
      if (knownDirs.current.has(treePath)) {
        return;
      }
      const abs = absByTree.current.get(treePath);
      if (!abs) {
        return;
      }
      void rpc.editor.open(abs).catch((err: unknown) => {
        toast.error(`Não foi possível abrir ${basename(abs)}`, err);
      });
    },
  });

  const search = useFileTreeSearch(model);

  const firstRootTreePath = useCallback((): string | undefined => {
    for (const dir of knownDirs.current) {
      if (!dir.slice(0, -1).includes("/")) {
        return dir;
      }
    }
    return undefined;
  }, []);

  const resolveCreateParent = useCallback((): string | undefined => {
    if (selectedTreePath) {
      if (knownDirs.current.has(selectedTreePath)) {
        return selectedTreePath;
      }
      const parent = selectedTreePath.replace(/[^/]+$/, "");
      if (knownDirs.current.has(parent)) {
        return parent;
      }
    }
    return firstRootTreePath();
  }, [selectedTreePath, firstRootTreePath]);

  const startCreate = useCallback(
    (kind: "file" | "folder") => {
      const parentTreePath = resolveCreateParent();
      if (!parentTreePath) {
        toast.error("Nenhuma pasta aberta");
        return;
      }
      setCreating({ kind, parentTreePath });
    },
    [resolveCreateParent],
  );

  const submitCreate = useCallback(
    async (name: string) => {
      if (!creating) {
        return;
      }
      const trimmed = name.trim();
      if (!trimmed) {
        setCreating(null);
        return;
      }
      const parentAbs = absByTree.current.get(creating.parentTreePath);
      if (!parentAbs) {
        setCreating(null);
        return;
      }
      try {
        const newAbs =
          creating.kind === "file"
            ? await rpc.fs.createFile(parentAbs, trimmed)
            : await rpc.fs.createDirectory(parentAbs, trimmed);
        const childTreePath =
          creating.kind === "folder"
            ? `${creating.parentTreePath}${trimmed}/`
            : `${creating.parentTreePath}${trimmed}`;
        if (!absByTree.current.has(childTreePath)) {
          absByTree.current.set(childTreePath, newAbs);
          if (creating.kind === "folder") {
            knownDirs.current.add(childTreePath);
            loadedDirs.current.add(childTreePath);
          }
          model.batch([{ type: "add", path: childTreePath }]);
        }
        if (creating.kind === "file") {
          void rpc.editor.open(newAbs).catch((err: unknown) => {
            toast.error(`Não foi possível abrir ${trimmed}`, err);
          });
        }
      } catch (err) {
        toast.error(
          creating.kind === "file"
            ? `Não foi possível criar arquivo`
            : `Não foi possível criar pasta`,
          err,
        );
      } finally {
        setCreating(null);
      }
    },
    [creating, model],
  );

  const loadRoots = useCallback(async () => {
    try {
      const roots = await rpc.fs.listWorkspaceRoots();
      absByTree.current = new Map();
      knownDirs.current = new Set();
      loadedDirs.current = new Set();
      loadingDirs.current = new Set();
      const taken = new Set<string>();
      const treePaths: string[] = [];
      for (const root of roots) {
        const name = uniqueName(basename(root.path) || root.path, taken);
        taken.add(name);
        const treePath = `${name}/`;
        absByTree.current.set(treePath, root.path);
        knownDirs.current.add(treePath);
        treePaths.push(treePath);
      }
      model.resetPaths(treePaths);
      setRootsCount(treePaths.length);
      setError(undefined);
      setReady(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setReady(true);
    }
  }, [model]);

  useEffect(() => {
    void loadRoots();
    const offChanged = rpc.on("workspace.changed", () => {
      void loadRoots();
    });
    const offVisibility = rpc.on("visibility.changed", (payload) => {
      if (payload === true) {
        setRenderKey((k) => k + 1);
      }
    });
    return () => {
      offChanged();
      offVisibility();
    };
  }, [loadRoots]);

  useEffect(() => {
    const loadChildren = async (treeDir: string) => {
      const abs = absByTree.current.get(treeDir);
      if (!abs) {
        return;
      }
      loadingDirs.current.add(treeDir);
      try {
        const list = await rpc.fs.list(abs);
        const sorted = sortEntries(list, sortModeRef.current);
        const ops: { type: "add"; path: string }[] = [];
        for (const entry of sorted) {
          const childTreePath = entry.isDirectory
            ? `${treeDir}${entry.name}/`
            : `${treeDir}${entry.name}`;
          if (absByTree.current.has(childTreePath)) {
            continue;
          }
          absByTree.current.set(childTreePath, entry.path);
          if (entry.isDirectory) {
            knownDirs.current.add(childTreePath);
          }
          ops.push({ type: "add", path: childTreePath });
        }
        if (ops.length > 0) {
          model.batch(ops);
        }
        loadedDirs.current.add(treeDir);
      } catch (err) {
        loadedDirs.current.add(treeDir);
        console.warn(`fs.list failed for ${abs}:`, err);
      } finally {
        loadingDirs.current.delete(treeDir);
      }
    };

    const scan = () => {
      for (const dir of knownDirs.current) {
        if (loadedDirs.current.has(dir) || loadingDirs.current.has(dir)) {
          continue;
        }
        const item = model.getItem(dir);
        if (item && "isExpanded" in item && item.isExpanded()) {
          void loadChildren(dir);
        }
      }
    };

    const off = model.subscribe(scan);
    return () => {
      off();
    };
  }, [model]);

  const toggleSort = useCallback(() => {
    const next: SortMode = sortMode === "name" ? "mtime" : "name";
    setSortMode(next);
    patchPersisted({ sortMode: next });
    void loadRoots();
  }, [sortMode, patchPersisted, loadRoots]);

  const openBookmark = useCallback((entry: BookmarkEntry) => {
    if (entry.isDirectory) {
      return;
    }
    void rpc.editor.open(entry.abs).catch((err: unknown) => {
      toast.error(`Não foi possível abrir ${entry.label}`, err);
    });
  }, []);

  const deleteItem = useCallback(
    async (abs: string, label: string) => {
      try {
        await rpc.fs.delete(abs);
        const treeEntries: string[] = [];
        for (const [treePath, mapped] of absByTree.current) {
          if (mapped === abs || mapped.startsWith(`${abs}/`)) {
            treeEntries.push(treePath);
          }
        }
        for (const treePath of treeEntries) {
          absByTree.current.delete(treePath);
          knownDirs.current.delete(treePath);
          loadedDirs.current.delete(treePath);
          loadingDirs.current.delete(treePath);
          const item = model.getItem(treePath);
          if (item) {
            model.batch([{ type: "remove", path: treePath }]);
          }
        }
        if (bookmarkedAbsSet.has(abs)) {
          removeBookmark(abs);
        }
      } catch (err) {
        toast.error(`Não foi possível deletar ${label}`, err);
      }
    },
    [model, bookmarkedAbsSet, removeBookmark],
  );

  const renderContextMenu = useCallback(
    (
      item: { kind: "directory" | "file"; name: string; path: string },
      context: {
        anchorRect: ContextMenuAnchorRect;
        close: (options?: { restoreFocus?: boolean }) => void;
      },
    ) => {
      const abs = absByTree.current.get(item.path);
      if (!abs) {
        return null;
      }
      const isBookmarked = bookmarkedAbsSet.has(abs);
      const isDirectory = item.kind === "directory";
      return (
        <LeftAnchoredMenu anchorRect={context.anchorRect}>
          <MenuItem
            icon={isDirectory ? FolderOpen : FileIcon}
            label={isDirectory ? "Abrir pasta" : "Abrir"}
            disabled={isDirectory}
            onClick={() => {
              context.close();
              if (!isDirectory) {
                void rpc.editor.open(abs).catch((err: unknown) => {
                  toast.error(`Não foi possível abrir ${item.name}`, err);
                });
              }
            }}
          />
          {isDirectory ? (
            <>
              <MenuItem
                icon={FilePlus}
                label="Novo arquivo aqui"
                onClick={() => {
                  context.close();
                  setCreating({ kind: "file", parentTreePath: item.path });
                }}
              />
              <MenuItem
                icon={FolderPlus}
                label="Nova pasta aqui"
                onClick={() => {
                  context.close();
                  setCreating({ kind: "folder", parentTreePath: item.path });
                }}
              />
            </>
          ) : null}
          <MenuSeparator />
          <MenuItem
            icon={Pencil}
            label="Renomear"
            onClick={() => {
              context.close();
              model.startRenaming(item.path);
            }}
          />
          <MenuItem
            icon={isBookmarked ? BookmarkMinus : BookmarkPlus}
            label={isBookmarked ? "Remover bookmark" : "Adicionar bookmark"}
            onClick={() => {
              context.close();
              if (isBookmarked) {
                removeBookmark(abs);
              } else {
                addBookmark({
                  abs,
                  label: item.name,
                  isDirectory,
                });
              }
            }}
          />
          <MenuSeparator />
          <MenuItem
            icon={Trash2}
            label="Deletar"
            variant="destructive"
            onClick={() => {
              context.close();
              void deleteItem(abs, item.name);
            }}
          />
        </LeftAnchoredMenu>
      );
    },
    [addBookmark, removeBookmark, bookmarkedAbsSet, deleteItem, model],
  );

  if (error) {
    return (
      <ErrorState
        message={error}
        action={
          <button
            type="button"
            onClick={() => void loadRoots()}
            className="rounded-md border border-border bg-secondary px-3 py-1 text-xs text-secondary-foreground hover:bg-secondary/80"
          >
            Tentar novamente
          </button>
        }
      />
    );
  }

  if (!ready) {
    return <Spinner className="p-3" label="carregando..." />;
  }

  if (rootsCount === 0) {
    return (
      <EmptyState
        title="Nenhuma pasta aberta"
        icon={FolderPlus}
        action={
          <button
            type="button"
            onClick={() => {
              rpc.workspace.chooseFolder().catch((err: unknown) => {
                toast.error("Não foi possível abrir o seletor de pasta", err);
              });
            }}
            className="rounded-md border border-border bg-secondary px-3 py-1 text-xs text-secondary-foreground hover:bg-secondary/80"
          >
            Abrir pasta
          </button>
        }
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col text-xs">
      <NavigateToolbar
        sortMode={sortMode}
        onToggleSort={toggleSort}
        onOpenFilter={() => {
          if (search.isOpen) {
            search.close();
          } else {
            search.open("");
          }
        }}
        filterActive={search.isOpen}
        onNewFile={() => startCreate("file")}
        onNewFolder={() => startCreate("folder")}
        onRefresh={() => void loadRoots()}
        creating={creating}
        onCreateSubmit={submitCreate}
        onCreateCancel={() => setCreating(null)}
      />
      {bookmarks.length > 0 ? (
        <BookmarksBar bookmarks={bookmarks} onOpen={openBookmark} onRemove={removeBookmark} />
      ) : null}
      <div className="relative flex min-h-0 flex-1">
        <FileTreeView
          key={renderKey}
          model={model}
          renderContextMenu={renderContextMenu}
          className={cn("h-full w-full")}
          style={{ height: "100%" }}
        />
      </div>
    </div>
  );
}

type NavigateToolbarProps = {
  sortMode: SortMode;
  onToggleSort: () => void;
  onOpenFilter: () => void;
  filterActive: boolean;
  onNewFile: () => void;
  onNewFolder: () => void;
  onRefresh: () => void;
  creating: CreateMode;
  onCreateSubmit: (name: string) => void;
  onCreateCancel: () => void;
};

function NavigateToolbar({
  sortMode,
  onToggleSort,
  onOpenFilter,
  filterActive,
  onNewFile,
  onNewFolder,
  onRefresh,
  creating,
  onCreateSubmit,
  onCreateCancel,
}: NavigateToolbarProps) {
  const [draft, setDraft] = useState("");
  useEffect(() => {
    if (creating) {
      setDraft("");
    }
  }, [creating]);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onCreateSubmit(draft);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCreateCancel();
    }
  };

  const sortLabel = sortMode === "name" ? "Ordenar por data" : "Ordenar por nome";
  const SortIcon = sortMode === "name" ? Clock : ArrowDownAZ;

  return (
    <div className="flex flex-col border-b border-border bg-muted/30">
      <div className="flex items-center gap-0.5 px-1 py-1">
        <IconButton
          icon={FilePlus}
          label="Novo arquivo"
          onClick={onNewFile}
          disabled={creating !== null}
        />
        <IconButton
          icon={FolderPlus}
          label="Nova pasta"
          onClick={onNewFolder}
          disabled={creating !== null}
        />
        <IconButton
          icon={RefreshCw}
          label="Atualizar"
          onClick={onRefresh}
          disabled={creating !== null}
        />
        <div className="mx-1 h-4 w-px bg-border" />
        <IconButton
          icon={Filter}
          label="Filtrar por nome"
          onClick={onOpenFilter}
          active={filterActive}
        />
        <IconButton
          icon={SortIcon}
          label={sortLabel}
          onClick={onToggleSort}
          active={sortMode === "mtime"}
        />
      </div>
      {creating ? (
        <div className="flex items-center gap-1 border-t border-border px-2 py-1">
          {creating.kind === "folder" ? (
            <Folder className="size-3.5 text-primary" />
          ) : (
            <FileIcon className="size-3.5 text-muted-foreground" />
          )}
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={() => onCreateCancel()}
            placeholder={creating.kind === "folder" ? "nome da pasta" : "nome do arquivo"}
            className="flex-1 rounded-sm border border-border bg-background px-1.5 py-0.5 text-xs outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      ) : null}
    </div>
  );
}

type LeftAnchoredMenuProps = {
  anchorRect: ContextMenuAnchorRect;
  children: ReactNode;
};

function LeftAnchoredMenu({ anchorRect, children }: LeftAnchoredMenuProps) {
  const style: React.CSSProperties = {
    position: "fixed",
    top: anchorRect.bottom + 4,
    left: anchorRect.right,
    transform: "translateX(-100%)",
    zIndex: 2147483647,
  };
  return createPortal(
    <div data-file-tree-context-menu-root="true" style={style}>
      <div className="flex min-w-[200px] flex-col rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md">
        {children}
      </div>
    </div>,
    document.body,
  );
}

type MenuItemProps = {
  icon: typeof FilePlus;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "destructive";
};

function MenuItem({ icon: Icon, label, onClick, disabled, variant = "default" }: MenuItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-2 rounded-sm px-2 py-1 text-left text-xs",
        "hover:bg-accent focus-visible:bg-accent",
        "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent",
        variant === "destructive" &&
          "text-destructive hover:bg-destructive/10 hover:text-destructive focus-visible:bg-destructive/10",
      )}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
}

function MenuSeparator() {
  return <div className="my-1 h-px bg-border" />;
}

type IconButtonProps = {
  icon: typeof FilePlus;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
};

function IconButton({ icon: Icon, label, onClick, disabled, active }: IconButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex size-6 items-center justify-center rounded-sm text-muted-foreground",
        "hover:bg-accent hover:text-accent-foreground",
        "disabled:cursor-not-allowed disabled:opacity-40",
        active && "bg-accent text-accent-foreground",
      )}
    >
      <Icon className="size-3.5" />
    </button>
  );
}

type BookmarksBarProps = {
  bookmarks: BookmarkEntry[];
  onOpen: (entry: BookmarkEntry) => void;
  onRemove: (abs: string) => void;
};

function BookmarksBar({ bookmarks, onOpen, onRemove }: BookmarksBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/30 px-2 py-1.5">
      <div className="mr-1 flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Bookmark className="size-3" />
        Bookmarks
      </div>
      {bookmarks.map((b) => (
        <div
          key={b.abs}
          className="group flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5"
        >
          <button
            type="button"
            onClick={() => {
              onOpen(b);
            }}
            className="flex items-center gap-1 text-left"
            title={b.abs}
          >
            {b.isDirectory ? <Folder className="size-3" /> : <FileIcon className="size-3" />}
            <span className="max-w-[120px] truncate">{b.label}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onRemove(b.abs);
            }}
            className="text-muted-foreground opacity-60 hover:opacity-100"
            aria-label="Remover bookmark"
          >
            <X className="size-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
