package main

import (
	"sort"
	"sync"
	"time"
)

// benchSampleSize define o tamanho do ring buffer por operação que alimenta
// os percentis. Quanto maior, mais estável; quanto menor, mais reativo.
const benchSampleSize = 256

// BenchOp é a fotografia exposta ao frontend para uma operação instrumentada.
type BenchOp struct {
	Name     string `json:"name"`
	Count    int64  `json:"count"`
	TotalNs  int64  `json:"totalNs"`
	MeanNs   int64  `json:"meanNs"`
	MinNs    int64  `json:"minNs"`
	MaxNs    int64  `json:"maxNs"`
	P50Ns    int64  `json:"p50Ns"`
	P95Ns    int64  `json:"p95Ns"`
	P99Ns    int64  `json:"p99Ns"`
	LastNs   int64  `json:"lastNs"`
	LastUnix int64  `json:"lastUnix"`
}

type opStat struct {
	count    int64
	totalNs  int64
	minNs    int64
	maxNs    int64
	samples  []int64
	nextIdx  int
	lastNs   int64
	lastUnix int64
}

// Bench coleta métricas de latência por operação. As escritas são protegidas
// por um único mutex; o overhead típico é < 1µs por chamada Time.
type Bench struct {
	mu      sync.Mutex
	stats   map[string]*opStat
	enabled bool
}

// bench é o singleton usado pelos handlers para instrumentação. É mantido como
// global para evitar passar dependência por todos os construtores.
var bench = NewBench()

func NewBench() *Bench {
	return &Bench{stats: make(map[string]*opStat), enabled: true}
}

// Time inicia um timer e retorna uma função para ser deferred. Quando a
// operação está desabilitada, retorna um no-op para não pagar overhead.
//
// Uso típico:
//
//	defer bench.Time("App.ListDir")()
func (b *Bench) Time(op string) func() {
	if b == nil {
		return func() {}
	}
	b.mu.Lock()
	enabled := b.enabled
	b.mu.Unlock()
	if !enabled {
		return func() {}
	}
	start := time.Now()
	return func() {
		b.record(op, time.Since(start).Nanoseconds())
	}
}

func (b *Bench) record(op string, ns int64) {
	b.mu.Lock()
	defer b.mu.Unlock()
	s, ok := b.stats[op]
	if !ok {
		s = &opStat{minNs: ns, samples: make([]int64, 0, benchSampleSize)}
		b.stats[op] = s
	}
	s.count++
	s.totalNs += ns
	if ns < s.minNs {
		s.minNs = ns
	}
	if ns > s.maxNs {
		s.maxNs = ns
	}
	s.lastNs = ns
	s.lastUnix = time.Now().Unix()
	if len(s.samples) < benchSampleSize {
		s.samples = append(s.samples, ns)
	} else {
		s.samples[s.nextIdx] = ns
		s.nextIdx = (s.nextIdx + 1) % benchSampleSize
	}
}

// Stats retorna um snapshot ordenado por TotalNs (mais pesados primeiro).
// Os percentis são calculados sobre o ring buffer de samples.
func (b *Bench) Stats() []BenchOp {
	b.mu.Lock()
	defer b.mu.Unlock()
	out := make([]BenchOp, 0, len(b.stats))
	for name, s := range b.stats {
		sorted := append([]int64(nil), s.samples...)
		sort.Slice(sorted, func(i, j int) bool { return sorted[i] < sorted[j] })
		var p50, p95, p99 int64
		if n := len(sorted); n > 0 {
			p50 = sorted[n*50/100]
			p95 = sorted[clampIdx(n*95/100, n-1)]
			p99 = sorted[clampIdx(n*99/100, n-1)]
		}
		var mean int64
		if s.count > 0 {
			mean = s.totalNs / s.count
		}
		out = append(out, BenchOp{
			Name:     name,
			Count:    s.count,
			TotalNs:  s.totalNs,
			MeanNs:   mean,
			MinNs:    s.minNs,
			MaxNs:    s.maxNs,
			P50Ns:    p50,
			P95Ns:    p95,
			P99Ns:    p99,
			LastNs:   s.lastNs,
			LastUnix: s.lastUnix,
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].TotalNs > out[j].TotalNs })
	return out
}

func clampIdx(i, max int) int {
	if i > max {
		return max
	}
	if i < 0 {
		return 0
	}
	return i
}

// Reset zera todas as métricas acumuladas.
func (b *Bench) Reset() {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.stats = make(map[string]*opStat)
}

// SetEnabled liga/desliga a coleta. Quando desligado, Time vira no-op.
func (b *Bench) SetEnabled(enabled bool) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.enabled = enabled
}

// IsEnabled retorna o estado atual.
func (b *Bench) IsEnabled() bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.enabled
}
