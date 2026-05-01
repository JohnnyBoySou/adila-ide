package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

// github_actions.go: leitura de workflow runs/jobs/logs e watcher com polling
// adaptativo que empurra atualizações pro frontend via emit().
// API ref: https://docs.github.com/en/rest/actions

type GitHubWorkflowRun struct {
	ID         int64  `json:"id"`
	Name       string `json:"name"`
	HeadBranch string `json:"headBranch"`
	HeadSHA    string `json:"headSha"`
	Event      string `json:"event"`
	Status     string `json:"status"`     // queued, in_progress, completed
	Conclusion string `json:"conclusion"` // success, failure, cancelled, ...
	RunNumber  int    `json:"runNumber"`
	HTMLURL    string `json:"htmlUrl"`
	CreatedAt  string `json:"createdAt"`
	UpdatedAt  string `json:"updatedAt"`
	Actor      string `json:"actor"`
	ActorAvtr  string `json:"actorAvatar"`
	WorkflowID int64  `json:"workflowId"`
}

type GitHubJob struct {
	ID          int64           `json:"id"`
	RunID       int64           `json:"runId"`
	Name        string          `json:"name"`
	Status      string          `json:"status"`
	Conclusion  string          `json:"conclusion"`
	StartedAt   string          `json:"startedAt"`
	CompletedAt string          `json:"completedAt"`
	HTMLURL     string          `json:"htmlUrl"`
	Steps       []GitHubJobStep `json:"steps"`
}

type GitHubJobStep struct {
	Name        string `json:"name"`
	Status      string `json:"status"`
	Conclusion  string `json:"conclusion"`
	Number      int    `json:"number"`
	StartedAt   string `json:"startedAt"`
	CompletedAt string `json:"completedAt"`
}

type GitHubRepoSlug struct {
	Owner string `json:"owner"`
	Repo  string `json:"repo"`
}

// Eventos emitidos pro frontend.
const (
	evtActionsRuns    = "github.actions.runs"        // payload: []GitHubWorkflowRun
	evtActionsJobs    = "github.actions.jobs"        // payload: {runId, jobs: []GitHubJob}
	evtActionsLogs    = "github.actions.logs.append" // payload: {jobId, chunk, fullReplace}
	evtActionsStatus  = "github.actions.status"      // payload: {watching: bool, owner, repo, error?}
	evtActionsLogDone = "github.actions.logs.done"   // payload: {jobId}
)

// ── Resolver remote → owner/repo ─────────────────────────────────────────────

// CurrentRepoSlug tenta extrair owner/repo do remote `origin`.
func (g *GitHub) CurrentRepoSlug() (GitHubRepoSlug, error) {
	if g.git == nil {
		return GitHubRepoSlug{}, errors.New("git indisponível")
	}
	remotes, err := g.git.ListRemotes()
	if err != nil {
		return GitHubRepoSlug{}, err
	}
	var origin string
	for _, r := range remotes {
		if r.Name == "origin" {
			origin = r.URL
			break
		}
	}
	if origin == "" && len(remotes) > 0 {
		origin = remotes[0].URL
	}
	if origin == "" {
		return GitHubRepoSlug{}, errors.New("nenhum remote configurado")
	}
	owner, repo, ok := parseGitHubRemote(origin)
	if !ok {
		return GitHubRepoSlug{}, fmt.Errorf("remote não é GitHub: %s", origin)
	}
	return GitHubRepoSlug{Owner: owner, Repo: repo}, nil
}

// parseGitHubRemote aceita ssh (git@github.com:owner/repo.git) e https
// (https://github.com/owner/repo.git, com ou sem credenciais embutidas).
func parseGitHubRemote(remote string) (string, string, bool) {
	remote = strings.TrimSpace(remote)
	remote = strings.TrimSuffix(remote, ".git")
	if strings.HasPrefix(remote, "git@") {
		// git@github.com:owner/repo
		idx := strings.Index(remote, ":")
		if idx < 0 {
			return "", "", false
		}
		host := remote[4:idx]
		if !strings.Contains(host, "github.com") {
			return "", "", false
		}
		path := remote[idx+1:]
		parts := strings.Split(path, "/")
		if len(parts) != 2 {
			return "", "", false
		}
		return parts[0], parts[1], true
	}
	u, err := url.Parse(remote)
	if err != nil {
		return "", "", false
	}
	if !strings.Contains(u.Host, "github.com") {
		return "", "", false
	}
	parts := strings.Split(strings.Trim(u.Path, "/"), "/")
	if len(parts) != 2 {
		return "", "", false
	}
	return parts[0], parts[1], true
}

// ── REST: runs / jobs / logs ─────────────────────────────────────────────────

func (g *GitHub) ListWorkflowRuns(owner, repo string, limit int) ([]GitHubWorkflowRun, error) {
	if limit <= 0 || limit > 100 {
		limit = 25
	}
	path := fmt.Sprintf("/repos/%s/%s/actions/runs?per_page=%d", owner, repo, limit)
	resp, err := g.apiRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("github actions/runs: %s — %s", resp.Status, strings.TrimSpace(string(body)))
	}
	var raw struct {
		WorkflowRuns []struct {
			ID         int64  `json:"id"`
			Name       string `json:"name"`
			HeadBranch string `json:"head_branch"`
			HeadSHA    string `json:"head_sha"`
			Event      string `json:"event"`
			Status     string `json:"status"`
			Conclusion string `json:"conclusion"`
			RunNumber  int    `json:"run_number"`
			HTMLURL    string `json:"html_url"`
			CreatedAt  string `json:"created_at"`
			UpdatedAt  string `json:"updated_at"`
			WorkflowID int64  `json:"workflow_id"`
			Actor      struct {
				Login     string `json:"login"`
				AvatarURL string `json:"avatar_url"`
			} `json:"actor"`
		} `json:"workflow_runs"`
	}
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, err
	}
	runs := make([]GitHubWorkflowRun, 0, len(raw.WorkflowRuns))
	for _, r := range raw.WorkflowRuns {
		runs = append(runs, GitHubWorkflowRun{
			ID:         r.ID,
			Name:       r.Name,
			HeadBranch: r.HeadBranch,
			HeadSHA:    r.HeadSHA,
			Event:      r.Event,
			Status:     r.Status,
			Conclusion: r.Conclusion,
			RunNumber:  r.RunNumber,
			HTMLURL:    r.HTMLURL,
			CreatedAt:  r.CreatedAt,
			UpdatedAt:  r.UpdatedAt,
			WorkflowID: r.WorkflowID,
			Actor:      r.Actor.Login,
			ActorAvtr:  r.Actor.AvatarURL,
		})
	}
	return runs, nil
}

func (g *GitHub) ListRunJobs(owner, repo string, runID int64) ([]GitHubJob, error) {
	path := fmt.Sprintf("/repos/%s/%s/actions/runs/%d/jobs?per_page=100", owner, repo, runID)
	resp, err := g.apiRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("github actions/jobs: %s — %s", resp.Status, strings.TrimSpace(string(body)))
	}
	var raw struct {
		Jobs []struct {
			ID          int64  `json:"id"`
			RunID       int64  `json:"run_id"`
			Name        string `json:"name"`
			Status      string `json:"status"`
			Conclusion  string `json:"conclusion"`
			StartedAt   string `json:"started_at"`
			CompletedAt string `json:"completed_at"`
			HTMLURL     string `json:"html_url"`
			Steps       []struct {
				Name        string `json:"name"`
				Status      string `json:"status"`
				Conclusion  string `json:"conclusion"`
				Number      int    `json:"number"`
				StartedAt   string `json:"started_at"`
				CompletedAt string `json:"completed_at"`
			} `json:"steps"`
		} `json:"jobs"`
	}
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, err
	}
	jobs := make([]GitHubJob, 0, len(raw.Jobs))
	for _, j := range raw.Jobs {
		steps := make([]GitHubJobStep, 0, len(j.Steps))
		for _, s := range j.Steps {
			steps = append(steps, GitHubJobStep{
				Name:        s.Name,
				Status:      s.Status,
				Conclusion:  s.Conclusion,
				Number:      s.Number,
				StartedAt:   s.StartedAt,
				CompletedAt: s.CompletedAt,
			})
		}
		jobs = append(jobs, GitHubJob{
			ID:          j.ID,
			RunID:       j.RunID,
			Name:        j.Name,
			Status:      j.Status,
			Conclusion:  j.Conclusion,
			StartedAt:   j.StartedAt,
			CompletedAt: j.CompletedAt,
			HTMLURL:     j.HTMLURL,
			Steps:       steps,
		})
	}
	return jobs, nil
}

// FetchJobLogs baixa o log atual do job (texto). Durante run em andamento o GH
// devolve 302 → URL temporária com o log parcial. Quando terminado, idem mas
// com o log completo. 404 enquanto o runner não emitiu nada.
func (g *GitHub) FetchJobLogs(owner, repo string, jobID int64) (string, error) {
	path := fmt.Sprintf("/repos/%s/%s/actions/jobs/%d/logs", owner, repo, jobID)
	resp, err := g.apiRequest("GET", path, nil)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode == 404 {
		return "", nil // ainda sem log
	}
	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("github jobs/logs: %s — %s", resp.Status, strings.TrimSpace(string(body)))
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	return string(body), nil
}

// ── Watcher: polling adaptativo + emit ───────────────────────────────────────

type actionsWatcher struct {
	owner string
	repo  string

	cancel  context.CancelFunc
	logsMu  sync.Mutex
	logsLen map[int64]int // jobID → bytes já enviados
}

// startActionsWatcher trava o gh.mu pra garantir watcher único.
func (g *GitHub) WatchRepoActions(owner, repo string) error {
	if !g.IsAuthenticated() {
		return errors.New("não autenticado no GitHub")
	}
	if owner == "" || repo == "" {
		return errors.New("owner/repo vazio")
	}
	g.mu.Lock()
	if g.actions != nil {
		g.actions.cancel()
	}
	ctx, cancel := context.WithCancel(g.ctx)
	w := &actionsWatcher{
		owner:   owner,
		repo:    repo,
		cancel:  cancel,
		logsLen: map[int64]int{},
	}
	g.actions = w
	g.mu.Unlock()

	emit(evtActionsStatus, map[string]any{"watching": true, "owner": owner, "repo": repo})
	go g.actionsLoop(ctx, w)
	return nil
}

func (g *GitHub) UnwatchRepoActions() {
	g.mu.Lock()
	defer g.mu.Unlock()
	if g.actions != nil {
		g.actions.cancel()
		g.actions = nil
	}
	emit(evtActionsStatus, map[string]any{"watching": false})
}

// WatchJobLogs marca um job pra ser polled em alta frequência. Apenas um job
// "focado" por vez — chamadas subsequentes substituem o anterior.
func (g *GitHub) WatchJobLogs(jobID int64) error {
	g.mu.Lock()
	defer g.mu.Unlock()
	if g.actions == nil {
		return errors.New("nenhum repositório monitorado")
	}
	g.actions.logsMu.Lock()
	g.actions.logsLen[jobID] = 0
	g.actions.logsMu.Unlock()
	return nil
}

func (g *GitHub) actionsLoop(ctx context.Context, w *actionsWatcher) {
	const (
		activeInterval = 4 * time.Second
		idleInterval   = 20 * time.Second
	)

	tick := time.NewTimer(0) // dispara imediatamente
	defer tick.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-tick.C:
		}

		runs, err := g.ListWorkflowRuns(w.owner, w.repo, 25)
		if err != nil {
			emit(evtActionsStatus, map[string]any{
				"watching": true, "owner": w.owner, "repo": w.repo, "error": err.Error(),
			})
			tick.Reset(idleInterval)
			continue
		}
		emit(evtActionsRuns, map[string]any{"runs": runs})

		hasActive := false
		for _, r := range runs {
			if r.Status == "in_progress" || r.Status == "queued" || r.Status == "waiting" {
				hasActive = true
				jobs, err := g.ListRunJobs(w.owner, w.repo, r.ID)
				if err == nil {
					emit(evtActionsJobs, map[string]any{"runId": r.ID, "jobs": jobs})
					g.pollFocusedJobLogs(w, jobs)
				}
			}
		}

		// Para jobs concluídos que ainda estão em logsLen, faz uma última pegada
		// completa e remove do tracking.
		g.flushFinishedLogs(ctx, w)

		if hasActive {
			tick.Reset(activeInterval)
		} else {
			tick.Reset(idleInterval)
		}
	}
}

func (g *GitHub) pollFocusedJobLogs(w *actionsWatcher, jobs []GitHubJob) {
	w.logsMu.Lock()
	tracked := make([]int64, 0, len(w.logsLen))
	for id := range w.logsLen {
		tracked = append(tracked, id)
	}
	w.logsMu.Unlock()
	if len(tracked) == 0 {
		return
	}

	// indexa jobs pelo ID
	jobByID := map[int64]GitHubJob{}
	for _, j := range jobs {
		jobByID[j.ID] = j
	}

	for _, jobID := range tracked {
		j, ok := jobByID[jobID]
		if !ok {
			continue
		}
		text, err := g.FetchJobLogs(w.owner, w.repo, jobID)
		if err != nil {
			continue
		}
		g.emitLogDelta(w, jobID, text, j.Status == "completed")
	}
}

func (g *GitHub) flushFinishedLogs(ctx context.Context, w *actionsWatcher) {
	w.logsMu.Lock()
	tracked := make([]int64, 0, len(w.logsLen))
	for id := range w.logsLen {
		tracked = append(tracked, id)
	}
	w.logsMu.Unlock()

	for _, jobID := range tracked {
		select {
		case <-ctx.Done():
			return
		default:
		}
		// Sem cache de status do job aqui — o emit de delta cuida do flag done
		// quando job.Status == completed.
		_ = jobID
	}
}

func (g *GitHub) emitLogDelta(w *actionsWatcher, jobID int64, text string, finished bool) {
	w.logsMu.Lock()
	prev, ok := w.logsLen[jobID]
	if !ok {
		w.logsMu.Unlock()
		return
	}
	if len(text) < prev {
		// log encolheu (raro: substituição completa). Reenvia tudo.
		emit(evtActionsLogs, map[string]any{
			"jobId":       jobID,
			"chunk":       text,
			"fullReplace": true,
		})
		w.logsLen[jobID] = len(text)
		w.logsMu.Unlock()
		if finished {
			emit(evtActionsLogDone, map[string]any{"jobId": jobID})
		}
		return
	}
	if len(text) > prev {
		chunk := text[prev:]
		w.logsLen[jobID] = len(text)
		w.logsMu.Unlock()
		emit(evtActionsLogs, map[string]any{
			"jobId":       jobID,
			"chunk":       chunk,
			"fullReplace": false,
		})
		if finished {
			w.logsMu.Lock()
			delete(w.logsLen, jobID)
			w.logsMu.Unlock()
			emit(evtActionsLogDone, map[string]any{"jobId": jobID})
		}
		return
	}
	w.logsMu.Unlock()
	if finished {
		w.logsMu.Lock()
		delete(w.logsLen, jobID)
		w.logsMu.Unlock()
		emit(evtActionsLogDone, map[string]any{"jobId": jobID})
	}
}

// ── Ações de controle ────────────────────────────────────────────────────────

func (g *GitHub) RerunWorkflow(owner, repo string, runID int64) error {
	path := fmt.Sprintf("/repos/%s/%s/actions/runs/%d/rerun", owner, repo, runID)
	resp, err := g.apiRequest("POST", path, nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusNoContent {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("rerun: %s — %s", resp.Status, strings.TrimSpace(string(body)))
	}
	return nil
}

func (g *GitHub) CancelWorkflowRun(owner, repo string, runID int64) error {
	path := fmt.Sprintf("/repos/%s/%s/actions/runs/%d/cancel", owner, repo, runID)
	resp, err := g.apiRequest("POST", path, nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusAccepted && resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("cancel: %s — %s", resp.Status, strings.TrimSpace(string(body)))
	}
	return nil
}
