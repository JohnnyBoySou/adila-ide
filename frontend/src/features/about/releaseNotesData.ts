import type { ReleaseNotesPayload, VersionMeta } from "./types";
import releasesMarkdown from "../../../../RELEASES.md?raw";

// Cada release começa com um header no formato:
//   ## v0.1.0 — 2026-04-25 (current)
// "(current)" é opcional e marca a versão exibida por padrão na tela About.
//
// Aceitamos tanto "—" (em-dash) quanto "-" (hífen) como separador para tolerar
// edição manual sem se preocupar com o caractere correto.
const RELEASE_HEADER = /^##\s+v(\d+\.\d+\.\d+(?:[\w.-]*)?)\s+[—–-]\s+(\d{4}-\d{2}-\d{2})(\s*\(current\))?\s*$/im;

interface ParsedRelease {
  version: string;
  date: string;
  isCurrent: boolean;
  body: string;
}

function parseReleases(markdown: string): ParsedRelease[] {
  const lines = markdown.split("\n");
  const releases: ParsedRelease[] = [];
  let current: ParsedRelease | null = null;

  for (const line of lines) {
    const m = line.match(RELEASE_HEADER);
    if (m) {
      if (current) {
        current.body = current.body.trim();
        releases.push(current);
      }
      current = {
        version: m[1],
        date: m[2],
        isCurrent: Boolean(m[3]),
        body: "",
      };
      continue;
    }
    if (current) {
      current.body += line + "\n";
    }
  }
  if (current) {
    current.body = current.body.trim();
    releases.push(current);
  }

  // Se nenhuma release foi marcada como (current), assume a primeira do arquivo.
  if (releases.length > 0 && !releases.some((r) => r.isCurrent)) {
    releases[0].isCurrent = true;
  }
  return releases;
}

const RELEASES = parseReleases(releasesMarkdown);

export const VERSIONS: VersionMeta[] = RELEASES.map((r) => ({
  version: r.version,
  date: r.date,
  isCurrent: r.isCurrent,
}));

const notesMap: Record<string, ReleaseNotesPayload> = Object.fromEntries(
  RELEASES.map((r) => [
    r.version,
    {
      version: r.version,
      date: r.date,
      markdown: r.body,
    } satisfies ReleaseNotesPayload,
  ]),
);

export function listVersions(): VersionMeta[] {
  return VERSIONS;
}

export function getReleaseNotes(version: string): ReleaseNotesPayload | null {
  return notesMap[version] ?? null;
}
