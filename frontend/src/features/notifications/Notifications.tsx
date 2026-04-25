import { Bell } from "lucide-react";
import { memo, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DevProfiler } from "@/components/DevProfiler";
import { useNotificationsStore } from "@/stores/notificationsStore";
import { rpc } from "./rpc";
import type { LayoutMode, NotificationItem } from "./types";
import { ToastList } from "./components/Toast";

type Props = {
  /** Quando o usuário está na tela de notificações (view === "notifications"). */
  centerOpen?: boolean;
  /** Callback para abrir a tela de notificações (clique no sino fallback). */
  onOpenCenter?: () => void;
};

export const Notifications = memo(function Notifications({
  centerOpen = false,
  onOpenCenter,
}: Props = {}) {
  const items = useNotificationsStore((s) => s.items);

  useEffect(() => {
    const store = useNotificationsStore.getState();
    const offAdd = rpc.on("notification.add", (payload) => {
      const { item } = payload as { item: NotificationItem };
      store.add(item);
    });
    const offUpdate = rpc.on("notification.update", (payload) => {
      const { item } = payload as { item: NotificationItem };
      store.update(item);
    });
    const offRemove = rpc.on("notification.remove", (payload) => {
      const { id } = payload as { id: string };
      store.remove(id);
    });
    const offCenter = rpc.on("notifications.setCenterOpen", (payload) => {
      const { open } = payload as { open: boolean };
      if (open) onOpenCenter?.();
    });

    void rpc.ready();

    return () => {
      offAdd();
      offUpdate();
      offRemove();
      offCenter();
    };
  }, [onOpenCenter]);

  const toastItems = useMemo(() => items.filter((i) => !i.silent), [items]);

  useEffect(() => {
    const targetMode: LayoutMode = centerOpen
      ? "center"
      : toastItems.length > 0
        ? "toasts"
        : "idle";
    void rpc.setLayout(targetMode);
  }, [centerOpen, toastItems.length]);

  // Bell de fallback: aparece quando há itens silent-only e a central está fechada.
  const showBell = !centerOpen && toastItems.length === 0 && items.length > 0;

  return (
    <>
      {toastItems.length > 0 && !centerOpen && (
        <DevProfiler id="ToastList">
          <ToastList items={toastItems} />
        </DevProfiler>
      )}

      {showBell && (
        <Button
          variant="outline"
          size="icon"
          onClick={() => {
            onOpenCenter?.();
            void rpc.setCenterVisibility(true);
          }}
          aria-label="Abrir notificações"
          className="pointer-events-auto fixed right-4 bottom-4 rounded-full bg-popover shadow-md"
        >
          <Bell className="size-4 text-muted-foreground" />
          <Badge className="absolute -right-1 -top-1 size-4 min-w-0 rounded-full p-0 text-[10px]">
            {items.length}
          </Badge>
        </Button>
      )}
    </>
  );
});
