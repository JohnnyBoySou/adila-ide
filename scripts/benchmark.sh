#!/usr/bin/env bash
# Roda os benchmarks Go, salva em benchmarks/benchmark_<ts>.md e compara
# com o run anterior (terminal + arquivo).
#
# Env vars:
#   BENCHTIME   duração de cada bench (default 2s)
#   BENCHCOUNT  rodadas por bench p/ reduzir variância (default 1)
#   NOISE_PCT   threshold em % p/ marcar Δ como ruído/estável (default 3)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BENCH_FILTER="${1:-.}"
BENCHTIME="${BENCHTIME:-2s}"
BENCHCOUNT="${BENCHCOUNT:-1}"
NOISE_PCT="${NOISE_PCT:-3}"

mkdir -p benchmarks
TS=$(date +%Y%m%d_%H%M%S)
NEW_MD="benchmarks/benchmark_${TS}.md"
NEW_TXT="benchmarks/benchmark_${TS}.txt"

PREV_TXT=$(ls -t benchmarks/benchmark_*.txt 2>/dev/null | grep -v "${TS}" | head -1 || true)

HAS_BENCHSTAT=0
if command -v benchstat >/dev/null 2>&1; then
  HAS_BENCHSTAT=1
fi

echo "▶ Filter: ${BENCH_FILTER} · benchtime: ${BENCHTIME} · count: ${BENCHCOUNT} · noise: ±${NOISE_PCT}%"
[[ "${HAS_BENCHSTAT}" == "1" ]] && echo "  benchstat: ✓ disponível" || echo "  benchstat: ✗ (instale via 'go install golang.org/x/perf/cmd/benchstat@latest' p/ análise estatística)"
echo

go test -bench="${BENCH_FILTER}" -benchmem -benchtime="${BENCHTIME}" -count="${BENCHCOUNT}" -run='^$' ./... 2>&1 | tee "${NEW_TXT}"

# Extrai linhas de bench em TSV. Quando count>1, há várias linhas por bench;
# tiramos a média de ns/B/allocs ponderada por iters (usual do benchstat
# básico — para análise rigorosa, use benchstat).
parse() {
  awk '
    /^Benchmark/ {
      name=$1; sub(/-[0-9]+$/, "", name); sub(/^Benchmark/, "", name)
      iters[name] += $2 + 0
      ns[name]    += ($3 + 0) * ($2 + 0)
      by[name]    += ($5 + 0) * ($2 + 0)
      al[name]    += ($7 + 0) * ($2 + 0)
      runs[name]  += 1
      if (!(name in order)) { order[name] = ++cnt }
    }
    END {
      for (k in order) {
        keys[order[k]] = k
      }
      for (i = 1; i <= cnt; i++) {
        k = keys[i]
        if (iters[k] > 0) {
          printf "%s\t%d\t%d\t%d\t%d\t%d\n",
            k, iters[k], ns[k]/iters[k], by[k]/iters[k], al[k]/iters[k], runs[k]
        }
      }
    }
  ' "$1"
}

lookup() {
  echo "$1" | awk -v n="$2" -F'\t' '$1==n {print; exit}'
}

CPU=$(grep '^cpu:' "${NEW_TXT}" 2>/dev/null | sed 's/^cpu: //' || echo "unknown")
GOVER=$(go version | awk '{print $3}')

# === Gera MD ===================================================
{
  echo "# Benchmark — $(date '+%Y-%m-%d %H:%M:%S')"
  echo
  echo "- **Hardware:** ${CPU}"
  echo "- **Go:** ${GOVER}"
  echo "- **Filter:** \`${BENCH_FILTER}\` · **benchtime:** \`${BENCHTIME}\` · **count:** \`${BENCHCOUNT}\` · **ruído ignorado:** \`±${NOISE_PCT}%\`"
  echo
  echo "## Resultados"
  echo
  echo "| Benchmark | iters | ns/op | B/op | allocs/op |"
  echo "|---|---:|---:|---:|---:|"
  parse "${NEW_TXT}" | while IFS=$'\t' read -r name iters ns bytes allocs runs; do
    echo "| \`${name}\` | ${iters} | ${ns} | ${bytes} | ${allocs} |"
  done

  if [[ -n "${PREV_TXT}" ]]; then
    echo
    echo "## Comparação com run anterior"
    echo
    echo "_Anterior: \`$(basename "${PREV_TXT}")\`_"
    echo
    echo "| Benchmark | ns/op | Δ | B/op | Δ | allocs/op | Δ |"
    echo "|---|---:|---:|---:|---:|---:|---:|"
    PREV_PARSED=$(parse "${PREV_TXT}")
    parse "${NEW_TXT}" | awk -F'\t' -v prev="${PREV_PARSED}" -v noise="${NOISE_PCT}" '
      function deltaMD(old, new,    d, sign) {
        if (old+0 == 0) return "—"
        d = (new-old)*100/old
        sign = (d>0) ? "+" : ""
        if (d < -noise)     return sprintf("%s%.1f%% 🟢", sign, d)
        else if (d > noise) return sprintf("%s%.1f%% 🔴", sign, d)
        else                return sprintf("%s%.1f%% ─", sign, d)
      }
      BEGIN {
        n = split(prev, lines, "\n")
        for (i = 1; i <= n; i++) {
          split(lines[i], f, "\t")
          if (f[1] != "") {
            pns[f[1]] = f[3]; pby[f[1]] = f[4]; pal[f[1]] = f[5]
          }
        }
      }
      {
        name=$1; ns=$3; by=$4; al=$5
        if (!(name in pns)) {
          # NOVOS no topo via prefixo de ordenação alto.
          printf "999999.9999\t| `%s` | %s | NOVO | %s | NOVO | %s | NOVO |\n", name, ns, by, al
          next
        }
        absD = (ns - pns[name]) * 100 / pns[name]
        if (absD < 0) absD = -absD
        printf "%012.4f\t| `%s` | %s | %s | %s | %s | %s | %s |\n",
          absD, name, ns,
          deltaMD(pns[name], ns), by,
          deltaMD(pby[name], by), al,
          deltaMD(pal[name], al)
      }
    ' | sort -t$'\t' -k1,1 -nr | cut -f2-
  fi
} > "${NEW_MD}"

# === Comparação no terminal ===================================
if [[ -n "${PREV_TXT}" ]]; then
  echo
  echo "════════════════════════════════════════════════════════════════════════════════════════"
  echo " Comparação com $(basename "${PREV_TXT}")  ·  ruído |Δ| ≤ ${NOISE_PCT}%"
  echo "════════════════════════════════════════════════════════════════════════════════════════"
  printf "%-44s %14s %14s %14s %14s %12s %14s\n" "Benchmark" "ns/op" "Δ" "B/op" "Δ" "allocs/op" "Δ"
  printf "%-44s %14s %14s %14s %14s %12s %14s\n" "────────────────────────────────────────────" "─────────────" "─────────────" "─────────────" "─────────────" "───────────" "─────────────"

  PREV_PARSED=$(parse "${PREV_TXT}")
  parse "${NEW_TXT}" | awk -F'\t' -v prev="${PREV_PARSED}" -v noise="${NOISE_PCT}" '
    function fmt(old, new,    d, sign) {
      if (old+0 == 0) return "—"
      d = (new-old)*100/old
      sign = (d>0) ? "+" : ""
      if (d < -noise)     return "\033[32m" sign sprintf("%.1f", d) "%\033[0m"
      else if (d > noise) return "\033[31m" sign sprintf("%.1f", d) "%\033[0m"
      else                return "\033[2m" sign sprintf("%.1f", d) "%\033[0m"
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
        if (f[1] != "") { pns[f[1]] = f[3]; pby[f[1]] = f[4]; pal[f[1]] = f[5] }
      }
    }
    {
      name=$1; ns=$3; by=$4; al=$5
      if (!(name in pns)) {
        printf "999999.9999\t%-44s %14s %14s %14s %14s %12s %14s\n", name, ns, "NEW", by, "NEW", al, "NEW"
        next
      }
      absD = (ns - pns[name]) * 100 / pns[name]
      if (absD < 0) absD = -absD
      printf "%012.4f\t%-44s %14s %s %14s %s %12s %s\n",
        absD, name, ns, pad(fmt(pns[name], ns), 14),
              by, pad(fmt(pby[name], by), 14),
              al, pad(fmt(pal[name], al), 14)
    }
  ' | sort -t$'\t' -k1,1 -nr | cut -f2-

  # === benchstat se disponível ============================
  if [[ "${HAS_BENCHSTAT}" == "1" ]]; then
    echo
    echo "── benchstat (significância estatística) ──────────────────────────────────────────────"
    benchstat "${PREV_TXT}" "${NEW_TXT}" 2>&1 || true
  fi
fi

echo
echo "✅ Salvo em: ${NEW_MD}"
echo "📄 Raw:     ${NEW_TXT}"
if [[ "${BENCHCOUNT}" == "1" ]]; then
  echo "💡 Dica: rode com BENCHCOUNT=6 p/ reduzir variância. Use benchstat p/ comparação rigorosa."
fi
