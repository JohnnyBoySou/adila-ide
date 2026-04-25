import { useEffect, useState } from "react";
import { getIconResolver } from "@/lib/symbolIcons";
import { cn } from "@/lib/utils";

type Props = {
  name: string;
  isDir: boolean;
  className?: string;
};

export function SymbolIcon({ name, isDir, className }: Props) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getIconResolver()
      .then((r) => {
        if (cancelled) return;
        setSrc(isDir ? r.folder(name) : r.file(name));
      })
      .catch(() => {
        if (!cancelled) setSrc(null);
      });
    return () => {
      cancelled = true;
    };
  }, [name, isDir]);

  if (!src) {
    // placeholder neutro mantém o layout enquanto o tema carrega
    return <span className={cn("inline-block", className)} aria-hidden />;
  }

  return (
    <img
      src={src}
      alt=""
      aria-hidden
      draggable={false}
      className={cn("inline-block select-none", className)}
    />
  );
}
