import { create } from "zustand";
import type { NotificationItem } from "@/features/notifications/types";

interface NotificationsState {
  items: NotificationItem[];
  add: (item: NotificationItem) => void;
  update: (item: NotificationItem) => void;
  remove: (id: string) => void;
  clear: () => void;
}

export const useNotificationsStore = create<NotificationsState>((set) => ({
  items: [],
  add: (item) =>
    set((s) => ({ items: [item, ...s.items.filter((p) => p.id !== item.id)] })),
  update: (item) =>
    set((s) => ({ items: s.items.map((p) => (p.id === item.id ? item : p)) })),
  remove: (id) => set((s) => ({ items: s.items.filter((p) => p.id !== id) })),
  clear: () => set({ items: [] }),
}));
