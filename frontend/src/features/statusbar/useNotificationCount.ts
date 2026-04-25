import { useEffect, useState } from "react";
import { rpc } from "@/features/notifications/rpc";
import type { NotificationItem, Severity } from "@/features/notifications/types";

export function useNotificationCount() {
  const [items, setItems] = useState<NotificationItem[]>([]);

  useEffect(() => {
    const unsubs = [
      rpc.on("notification.add", (item: unknown) => {
        const n = item as NotificationItem;
        setItems((prev) => [n, ...prev.filter((p) => p.id !== n.id)]);
      }),
      rpc.on("notification.update", (item: unknown) => {
        const n = item as NotificationItem;
        setItems((prev) => prev.map((p) => (p.id === n.id ? n : p)));
      }),
      rpc.on("notification.remove", (id: unknown) => {
        setItems((prev) => prev.filter((p) => p.id !== id));
      }),
      rpc.on("notification.clearAll", () => {
        setItems([]);
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const count = items.length;
  const maxSeverity: Severity | null = items.some((i) => i.severity === "error")
    ? "error"
    : items.some((i) => i.severity === "warning")
      ? "warning"
      : items.length > 0
        ? "info"
        : null;

  return { count, maxSeverity };
}
