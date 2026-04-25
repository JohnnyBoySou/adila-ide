#!/usr/bin/env bash
# Roda os benchmarks vitest, salva em benchmarks/frontend_<ts>.md +
# frontend_<ts>.json e compara com o run anterior (terminal + arquivo).
#
# Env vars:
#   NOISE_PCT  threshold em % p/ marcar Δ como ruído/estável (default 5)
set -euo pipefail
export LC_ALL=C

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/frontend"

NOISE_PCT="${NOISE_PCT:-5}"

mkdir -p "$ROOT/benchmarks"
TS=$(date +%Y%m%d_%H%M%S)
NEW_JSON="$ROOT/benchmarks/frontend_${TS}.json"
NEW_MD="$ROOT/benchmarks/frontend_${TS}.md"

PREV_JSON=$(ls -t "$ROOT/benchmarks/"frontend_*.json 2>/dev/null | grep -v "${TS}" | head -1 || true)

echo "▶ vitest bench · noise: ±${NOISE_PCT}%"
echo

bun run bench 2>&1
cp .vitest-bench.json "$NEW_JSON"

# Extrai linhas: "<group> | <name>\t<hz>\t<mean_ms>\t<rme>"
parse() {
  jq -r '
    .files[] |
    .groups[] as $g |
    $g.benchmarks[] |
    [($g.fullName | sub("^src/__bench__/[^>]+>\\s*"; "")), .name, .hz, (.mean*1000), .rme] |
    @tsv
  ' "$1"
}

# === Gera MD ===================================================
NODE_VER=$(node --version 2>/dev/null || echo "n/a")
BUN_VER=$(bun --version 2>/dev/null || echo "n/a")
{
  echo "# Frontend Benchmark — $(date '+%Y-%m-%d %H:%M:%S')"
  echo
  echo "- **Node:** ${NODE_VER}"
  echo "- **Bun:** ${BUN_VER}"
  echo "- **Ruído ignorado:** \`±${NOISE_PCT}%\`"
  echo
  echo "## Resultados"
  echo
  echo "| Grupo | Benchmark | hz (ops/s) | mean (ms) | rme |"
  echo "|---|---|---:|---:|---:|"
  parse "$NEW_JSON" | while IFS=$'\t' read -r group name hz mean rme; do
    printf "| %s | \`%s\` | %'.0f | %.4f | ±%.2f%% |\n" "$group" "$name" "$hz" "$mean" "$rme"
  done

  if [[ -n "${PREV_JSON}" ]]; then
    echo
    echo "## Comparação com run anterior"
    echo
    echo "_Anterior: \`$(basename "${PREV_JSON}")\`_"
    echo
    echo "| Benchmark | hz | Δ | mean (ms) | Δ |"
    echo "|---|---:|---:|---:|---:|"
    PREV_PARSED=$(parse "$PREV_JSON")
    parse "$NEW_JSON" | awk -F'\t' -v prev="${PREV_PARSED}" -v noise="${NOISE_PCT}" '
      function deltaMD(old, new, higherBetter,    d, sign, good, bad) {
        if (old+0 == 0) return "—"
        d = (new-old)*100/old
        sign = (d>0) ? "+" : ""
        good = (higherBetter ? d > noise : d < -noise)
        bad  = (higherBetter ? d < -noise : d > noise)
        if (good)      return sprintf("%s%.1f%% 🟢", sign, d)
        else if (bad)  return sprintf("%s%.1f%% 🔴", sign, d)
        else           return sprintf("%s%.1f%% ─", sign, d)
      }
      BEGIN {
        n = split(prev, lines, "\n")
        for (i = 1; i <= n; i++) {
          split(lines[i], f, "\t")
          if (f[2] != "") {
            key = f[1] "|" f[2]
            phz[key] = f[3]; pms[key] = f[4]
          }
        }
      }
      {
        key = $1 "|" $2
        if (!(key in phz)) {
          printf "999999.9999\t| `%s` | %.0f | NOVO | %.4f | NOVO |\n", $2, $3, $4
          next
        }
        absD = ($3 - phz[key]) * 100 / phz[key]
        if (absD < 0) absD = -absD
        printf "%012.4f\t| `%s` | %.0f | %s | %.4f | %s |\n",
          absD, $2, $3, deltaMD(phz[key], $3, 1), $4, deltaMD(pms[key], $4, 0)
      }
    ' | sort -t$'\t' -k1,1 -nr | cut -f2-
  fi
} > "$NEW_MD"

# === Comparação no terminal ===================================
if [[ -n "${PREV_JSON}" ]]; then
  echo
  echo "════════════════════════════════════════════════════════════════════════════════════════"
  echo " Comparação com $(basename "${PREV_JSON}")  ·  ruído |Δ| ≤ ${NOISE_PCT}%"
  echo "════════════════════════════════════════════════════════════════════════════════════════"
  printf "%-44s %14s %14s %12s %14s\n" "Benchmark" "hz" "Δ hz" "mean (ms)" "Δ ms"
  printf "%-44s %14s %14s %12s %14s\n" "────────────────────────────────────────────" "─────────────" "─────────────" "───────────" "─────────────"

  PREV_PARSED=$(parse "$PREV_JSON")
  parse "$NEW_JSON" | awk -F'\t' -v prev="${PREV_PARSED}" -v noise="${NOISE_PCT}" '
    function fmt(old, new, higherBetter,    d, sign, good, bad) {
      if (old+0 == 0) return "—"
      d = (new-old)*100/old
      sign = (d>0) ? "+" : ""
      good = (higherBetter ? d > noise : d < -noise)
      bad  = (higherBetter ? d < -noise : d > noise)
      if (good)      return "\033[32m" sign sprintf("%.1f", d) "%\033[0m"
      else if (bad)  return "\033[31m" sign sprintf("%.1f", d) "%\033[0m"
      else           return "\033[2m" sign sprintf("%.1f", d) "%\033[0m"
    }
    function pad(s, w,    plain, vis) {
      plain = s
      gsub(/\033\[[0-9;]*m/, "", plain)
      vis = length(plain)
      if (vis >= w) return s
      return sprintf("%*s", w - vis, "") s
    }
    BEGIN {
      n = split(prev, lines, "\n")
      for (i = 1; i <= n; i++) {
        split(lines[i], f, "\t")
        if (f[2] != "") {
          key = f[1] "|" f[2]
          phz[key] = f[3]; pms[key] = f[4]
        }
      }
    }
    {
      key = $1 "|" $2
      if (!(key in phz)) {
        printf "%-44s %14.0f %14s %12.4f %14s\n", substr($2,1,44), $3, "NEW", $4, "NEW"
        next
      }
      absD = ($3 - phz[key]) * 100 / phz[key]
      if (absD < 0) absD = -absD
      printf "%012.4f\t%-44s %14.0f %s %12.4f %s\n",
        absD, substr($2,1,44), $3, pad(fmt(phz[key], $3, 1), 14),
                                $4, pad(fmt(pms[key], $4, 0), 14)
    }
  ' | sort -t$'\t' -k1,1 -nr | cut -f2-
fi

echo
echo "✅ Salvo em: ${NEW_MD}"
echo "📄 Raw:     ${NEW_JSON}"
