import { useMemo } from "react";
import DOMPurify from "dompurify";
import { marked } from "marked";

type MarkdownViewProps = {
  markdown: string;
};

export function MarkdownView({ markdown }: MarkdownViewProps) {
  const html = useMemo(() => {
    const rendered = marked.parse(markdown) as string;
    return DOMPurify.sanitize(rendered);
  }, [markdown]);

  return (
    <div
      className="prose-about"
      style={{ color: "var(--vscode-foreground)" }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
