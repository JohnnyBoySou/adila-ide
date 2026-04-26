import { useEffect, useState } from "react";
import { getIconResolver, type IconResolution } from "@/lib/iconThemes";
import { useIconThemeStore } from "@/stores/iconThemeStore";
import { cn } from "@/lib/utils";

type Props = {
  name: string;
  isDir: boolean;
  className?: string;
};

export function SymbolIcon({ name, isDir, className }: Props) {
  const themeId = useIconThemeStore((s) => s.themeId);
  const [res, setRes] = useState<IconResolution | null>(null);

  useEffect(() => {
    let cancelled = false;
    getIconResolver(themeId)
      .then((r) => {
        if (cancelled) return;
        setRes(isDir ? r.folder(name) : r.file(name));
      })
      .catch(() => {
        if (!cancelled) setRes(null);
      });
    return () => {
      cancelled = true;
    };
  }, [name, isDir, themeId]);

  if (!res) {
    return <span className={cn("inline-block", className)} aria-hidden />;
  }

  if (res.kind === "lucide") {
    const Icon = res.icon;
    return <Icon className={cn("inline-block shrink-0", res.color, className)} aria-hidden />;
  }

  return (
    <img
      src={res.url}
      alt=""
      aria-hidden
      draggable={false}
      className={cn("inline-block select-none", className)}
    />
  );
}
