import { memo, useEffect, useRef } from "react";

type Props = {
  text: string;
  done: boolean;
};

export const LogViewer = memo(function LogViewer({ text, done }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (stickRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [text]);

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    const slack = 16;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight <= slack;
  };

  return (
    <div
      ref={ref}
      onScroll={onScroll}
      className="h-full overflow-auto bg-background text-[11px] leading-[1.4] font-mono whitespace-pre-wrap p-2 select-text"
    >
      {text || (
        <span className="text-muted-foreground italic">
          {done ? "(sem logs)" : "Aguardando primeiro chunk…"}
        </span>
      )}
    </div>
  );
});
