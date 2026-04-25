import { useEffect, useState } from "react";

export type ToastVariant = "default" | "success" | "error";

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

type Listener = (toasts: Toast[]) => void;

const listeners = new Set<Listener>();
let state: Toast[] = [];
const AUTO_DISMISS_MS = 4000;

function notify() {
  for (const l of listeners) {
    l(state);
  }
}

function emit(title: string, description: string | undefined, variant: ToastVariant): string {
  const id = Math.random().toString(36).slice(2, 10);
  state = [...state, { id, title, description, variant }];
  notify();
  setTimeout(() => {
    dismiss(id);
  }, AUTO_DISMISS_MS);
  return id;
}

function dismiss(id: string): void {
  state = state.filter((t) => t.id !== id);
  notify();
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === "string") {
    return err;
  }
  return "erro desconhecido";
}

export const toast = {
  show: (title: string, description?: string) => emit(title, description, "default"),
  success: (title: string, description?: string) => emit(title, description, "success"),
  error: (title: string, err?: unknown) =>
    emit(title, err === undefined ? undefined : errorMessage(err), "error"),
  dismiss,
};

export function useToasts(): Toast[] {
  const [current, setCurrent] = useState(state);
  useEffect(() => {
    listeners.add(setCurrent);
    return () => {
      listeners.delete(setCurrent);
    };
  }, []);
  return current;
}
