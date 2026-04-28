/**
 * Métricas de renderização — todas as posições do editor são derivadas a
 * partir de (lineHeight, charWidth). charWidth assume fonte monospace.
 */
export type Metrics = {
  lineHeight: number;
  charWidth: number;
  fontSize: number;
  fontFamily: string;
};

export function measureCharWidth(fontFamily: string, fontSize: number): number {
  // Mede com canvas pra evitar reflow. Cache simples.
  const key = `${fontFamily}|${fontSize}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return fontSize * 0.6;
  ctx.font = `${fontSize}px ${fontFamily}`;
  // Caractere 'M' é tradicionalmente o mais largo, mas pra monospace o
  // valor é constante. Usamos média de 'mwxi0' pra robustez se a fonte
  // declarada cair pra fallback proporcional.
  const w = ctx.measureText("Mwxi0").width / 5;
  const result = w || fontSize * 0.6;
  cache.set(key, result);
  return result;
}

const cache = new Map<string, number>();
