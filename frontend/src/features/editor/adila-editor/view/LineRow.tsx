import { memo } from "react";
import type { Token } from "../syntax/tokenize";
import { TOKEN_CLASS } from "../syntax/theme";

type Props = {
  text: string;
  tokens: Token[];
};

/**
 * Renderiza uma linha em spans tokenizados. Memo + chaves estáveis (start)
 * mantém o React eficiente quando linhas vizinhas re-renderizam.
 */
function LineRowInner({ text, tokens }: Props) {
  if (tokens.length === 0) {
    return <span className="tk-plain">{text || " "}</span>;
  }
  const out: React.ReactNode[] = [];
  let cursor = 0;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.start > cursor) {
      out.push(
        <span key={`p${cursor}`} className="tk-plain">
          {text.slice(cursor, t.start)}
        </span>,
      );
    }
    out.push(
      <span key={`t${t.start}`} className={TOKEN_CLASS[t.type]}>
        {text.slice(t.start, t.end)}
      </span>,
    );
    cursor = t.end;
  }
  if (cursor < text.length) {
    out.push(
      <span key={`p${cursor}`} className="tk-plain">
        {text.slice(cursor)}
      </span>,
    );
  }
  return <>{out}</>;
}

export const LineRow = memo(LineRowInner, (a, b) => a.text === b.text && a.tokens === b.tokens);
