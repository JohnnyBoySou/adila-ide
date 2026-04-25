import { useEffect, useRef } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";

type Props = { content: string };

export function MarkdownPreview({ content }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const render = async () => {
      const html = await marked(content, { breaks: true, gfm: true });
      const clean = DOMPurify.sanitize(html);
      if (ref.current) ref.current.innerHTML = clean;
    };
    void render();
  }, [content]);

  return (
    <div
      ref={ref}
      className="h-full overflow-auto px-8 py-6 prose prose-sm dark:prose-invert max-w-none
        prose-headings:font-semibold prose-a:text-primary prose-code:bg-muted
        prose-code:rounded prose-code:px-1 prose-pre:bg-muted prose-pre:rounded-md"
    />
  );
}
