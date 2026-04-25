import { useEffect, useState } from "react";

export type ShortcutHint = { label: string; id: number };

type Props = { hint: ShortcutHint | null };

const VISIBLE_MS = 500;
const FADE_MS = 150;

export function ShortcutHud({ hint }: Props) {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState<ShortcutHint | null>(null);

  useEffect(() => {
    if (!hint) return;
    setMounted(hint);
    setVisible(true);
    const hide = setTimeout(() => setVisible(false), VISIBLE_MS);
    const unmount = setTimeout(() => setMounted(null), VISIBLE_MS + FADE_MS);
    return () => {
      clearTimeout(hide);
      clearTimeout(unmount);
    };
  }, [hint]);

  if (!mounted) return null;

  const parts = mounted.label.split(/\s*\+\s*/);

  return (
    <div
      className={
        "fixed left-0 right-0 bottom-8 z-[100] pointer-events-none flex justify-center transition-all ease-out " +
        (visible ? "opacity-100 translate-y-0 duration-150" : "opacity-0 translate-y-2 duration-200")
      }
    >
      <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-black/75 backdrop-blur-xl shadow-2xl border border-white/10">
        {parts.map((p, i) => (
          <span key={`${mounted.id}-${i}`} className="flex items-center gap-2">
            {i > 0 && <span className="text-white/50 text-sm">+</span>}
            <kbd className="min-w-[1.75rem] px-2 py-0.5 rounded-md bg-white/10 text-white text-sm font-mono font-medium text-center border border-white/20 shadow-inner">
              {p}
            </kbd>
          </span>
        ))}
      </div>
    </div>
  );
}
