import { useEffect, useState } from "react";
import { Palette } from "./components/Palette";
import { rpc } from "./rpc";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialQuery?: string;
}

export function CommandPalette({ open, onOpenChange, initialQuery = "" }: CommandPaletteProps) {
  const [query, setQuery] = useState(initialQuery);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery, open]);

  // Bridge RPC ainda existe para o backend disparar abertura via host.
  useEffect(() => {
    const offOpen = rpc.on("commandCenter.open", (payload) => {
      const { initialPrefix } = payload as { initialPrefix: string };
      setQuery(initialPrefix);
      onOpenChange(true);
    });
    const offClose = rpc.on("commandCenter.close", () => {
      onOpenChange(false);
    });
    return () => {
      offOpen();
      offClose();
    };
  }, [onOpenChange]);

  if (!open) {
    return null;
  }

  return (
    <Palette
      initialQuery={query}
      onClose={() => {
        onOpenChange(false);
      }}
    />
  );
}
