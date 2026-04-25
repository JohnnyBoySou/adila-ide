import { Bell } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { rpc } from "./rpc";
import type { LayoutMode, NotificationItem } from "./types";
import { Center } from "./components/Center";
import { ToastList } from "./components/Toast";

// Matches the longest transition in <Center /> (panel translate) — keep in sync.
const CENTER_EXIT_MS = 320;

type Props = {
  /** Controle externo opcional do center (ex.: clique no sino da StatusBar). */
  centerOpen?: boolean;
  onCenterOpenChange?: (open: boolean) => void;
};

export function Notifications({ centerOpen: centerOpenProp, onCenterOpenChange }: Props = {}) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [centerOpenInternal, setCenterOpenInternal] = useState(false);
  const centerOpen = centerOpenProp ?? centerOpenInternal;
  const setCenterOpenRef = useRef((_open: boolean) => {});
  setCenterOpenRef.current = (open: boolean) => {
    if (onCenterOpenChange) onCenterOpenChange(open);
    else setCenterOpenInternal(open);
  };
  const setCenterOpen = (open: boolean) => setCenterOpenRef.current(open);

  // Wire up workbench → react event stream once.
  useEffect(() => {
    const offAdd = rpc.on("notification.add", (payload) => {
      const { item } = payload as { item: NotificationItem };
      setItems((prev) => [item, ...prev.filter((p) => p.id !== item.id)]);
    });
    const offUpdate = rpc.on("notification.update", (payload) => {
      const { item } = payload as { item: NotificationItem };
      setItems((prev) => prev.map((p) => (p.id === item.id ? item : p)));
    });
    const offRemove = rpc.on("notification.remove", (payload) => {
      const { id } = payload as { id: string };
      setItems((prev) => prev.filter((p) => p.id !== id));
    });
    // Workbench-driven open/close (status-bar bell click).
    const offCenter = rpc.on("notifications.setCenterOpen", (payload) => {
      const { open } = payload as { open: boolean };
      setCenterOpen(open);
    });

    void rpc.ready();

    return () => {
      offAdd();
      offUpdate();
      offRemove();
      offCenter();
    };
  }, []);

  // Visible toasts = non-silent notifications. Silent ones live in the center
  // only (matches the original NotificationPriority.SILENT behavior).
  const toastItems = useMemo(() => items.filter((i) => !i.silent), [items]);

  // Tell the workbench which surface we're showing so it can size the overlay
  // container appropriately. Center wins over toasts; idle when neither.
  // When the center closes, wait out the exit animation before shrinking the
  // host container — otherwise the iframe is hidden mid-animation.
  useEffect(() => {
    const targetMode: LayoutMode = centerOpen
      ? "center"
      : toastItems.length > 0
        ? "toasts"
        : "idle";
    if (centerOpen) {
      void rpc.setLayout(targetMode);
      return;
    }
    const t = setTimeout(() => {
      void rpc.setLayout(targetMode);
    }, CENTER_EXIT_MS);
    return () => {
      clearTimeout(t);
    };
  }, [centerOpen, toastItems.length]);

  // Trigger that opens the center: a small bell button in the bottom-right
  // when there are silent-only items (so the user can still get to them).
  const showBell = !centerOpen && toastItems.length === 0 && items.length > 0;

  return (
    <>
      {toastItems.length > 0 && !centerOpen && <ToastList items={toastItems} />}

      {showBell && (
        <button
          type="button"
          onClick={() => {
            setCenterOpen(true);
            void rpc.setCenterVisibility(true);
          }}
          aria-label="Abrir notificações"
          className="pointer-events-auto fixed right-4 bottom-4 rounded-full border border-border bg-popover p-2 shadow-md hover:bg-muted"
        >
          <Bell className="size-4 text-muted-foreground" />
          <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
            {items.length}
          </span>
        </button>
      )}

      <Center
        items={items}
        open={centerOpen}
        onClose={() => {
          setCenterOpen(false);
          // Defer the visibility ack until after the exit animation, otherwise
          // the host shrinks the overlay container mid-animation.
          setTimeout(() => {
            void rpc.setCenterVisibility(false);
          }, CENTER_EXIT_MS);
        }}
      />
    </>
  );
}
