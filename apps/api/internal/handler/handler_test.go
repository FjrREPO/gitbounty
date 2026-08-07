package handler

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/FjrREPO/gitbounty/apps/api/internal/domain"
	"github.com/FjrREPO/gitbounty/apps/api/internal/store"
)

type fakeStore struct {
	bounties     []domain.Bounty
	syncedAt     time.Time
	meta         *domain.GitHubMeta
	metaRepo     string
	unresolvable map[string]bool
}

func (f *fakeStore) ListBounties(context.Context) ([]domain.Bounty, error) {
	return f.bounties, nil
}

func (f *fakeStore) GetBounty(_ context.Context, id uint64) (domain.Bounty, error) {
	for _, b := range f.bounties {
		if b.ID == id {
			return b, nil
		}
	}
	return domain.Bounty{}, store.ErrNotFound
}

func (f *fakeStore) LastSyncedAt(context.Context) (time.Time, error) {
	return f.syncedAt, nil
}

func (f *fakeStore) UnresolvableRepos(context.Context) (map[string]bool, error) {
	return f.unresolvable, nil
}

func (f *fakeStore) GitHubMeta(_ context.Context, repo string, _ uint64) (domain.GitHubMeta, error) {
	if f.meta != nil && f.metaRepo == repo {
		return *f.meta, nil
	}
	return domain.GitHubMeta{Contributors: []domain.Contributor{}}, nil
}

func serve(t *testing.T, f *fakeStore, method, target string) *httptest.ResponseRecorder {
	t.Helper()
	h := New(f, nil, slog.New(slog.DiscardHandler))
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", h.Health)
	mux.HandleFunc("GET /api/v1/bounties", h.ListBounties)
	mux.HandleFunc("GET /api/v1/bounties/{id}", h.GetBounty)
	mux.HandleFunc("GET /api/v1/providers", h.ListProviders)
	mux.HandleFunc("GET /api/v1/github", h.GitHubMeta)

	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, httptest.NewRequest(method, target, nil))
	return rec
}

func TestListBounties(t *testing.T) {
	f := &fakeStore{bounties: []domain.Bounty{{ID: 2, Repo: "acme/demo", Status: domain.StatusOpen}}}
	rec := serve(t, f, http.MethodGet, "/api/v1/bounties")

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	var body struct {
		Bounties []domain.Bounty `json:"bounties"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(body.Bounties) != 1 || body.Bounties[0].Repo != "acme/demo" {
		t.Fatalf("unexpected body: %+v", body)
	}
}

func TestGetBounty(t *testing.T) {
	f := &fakeStore{bounties: []domain.Bounty{{ID: 7, Repo: "acme/demo"}}}

	if rec := serve(t, f, http.MethodGet, "/api/v1/bounties/7"); rec.Code != http.StatusOK {
		t.Fatalf("existing bounty status = %d", rec.Code)
	}
	if rec := serve(t, f, http.MethodGet, "/api/v1/bounties/999"); rec.Code != http.StatusNotFound {
		t.Fatalf("missing bounty status = %d", rec.Code)
	}
	if rec := serve(t, f, http.MethodGet, "/api/v1/bounties/abc"); rec.Code != http.StatusBadRequest {
		t.Fatalf("invalid id status = %d", rec.Code)
	}
}

func TestProviders(t *testing.T) {
	rec := serve(t, &fakeStore{}, http.MethodGet, "/api/v1/providers")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	var body struct {
		Providers []domain.Provider `json:"providers"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(body.Providers) == 0 || body.Providers[0].Name != "claude" {
		t.Fatalf("unexpected providers: %+v", body.Providers)
	}
}

func TestHealthIncludesSyncTime(t *testing.T) {
	f := &fakeStore{syncedAt: time.Unix(1_753_700_000, 0).UTC()}
	rec := serve(t, f, http.MethodGet, "/healthz")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	var body map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body["status"] != "ok" || body["lastSyncedAt"] == "" {
		t.Fatalf("unexpected health body: %v", body)
	}
}

func TestListBountiesEmbedsGitHubMeta(t *testing.T) {
	f := &fakeStore{
		bounties: []domain.Bounty{{ID: 1, Repo: "acme/demo"}},
		metaRepo: "acme/demo",
		meta: &domain.GitHubMeta{
			Repo: &domain.RepoStats{Repo: "acme/demo", Stars: 42, Commits: 100},
			Contributors: []domain.Contributor{
				{Login: "octocat", AvatarURL: "https://a", Contributions: 7},
			},
		},
	}
	rec := serve(t, f, http.MethodGet, "/api/v1/bounties")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	var body struct {
		Bounties []struct {
			Repo   string             `json:"repo"`
			GitHub *domain.GitHubMeta `json:"github"`
		} `json:"bounties"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body.Bounties[0].GitHub == nil || body.Bounties[0].GitHub.Repo.Stars != 42 {
		t.Fatalf("github meta not embedded: %+v", body.Bounties[0])
	}
}

func TestGitHubMetaEndpoint(t *testing.T) {
	f := &fakeStore{
		metaRepo: "acme/demo",
		meta: &domain.GitHubMeta{
			Repo: &domain.RepoStats{Repo: "acme/demo", PullRequests: 12},
		},
	}
	rec := serve(t, f, http.MethodGet, "/api/v1/github?repo=acme/demo&issue=42")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	if rec := serve(t, f, http.MethodGet, "/api/v1/github?repo=not-a-repo"); rec.Code != http.StatusBadRequest {
		t.Fatalf("invalid repo status = %d", rec.Code)
	}
}

// Regression: a bounty whose repo does not exist on GitHub is unclaimable
// noise and must not appear in the default list.
func TestListBountiesHidesUnresolvableRepos(t *testing.T) {
	f := &fakeStore{
		bounties: []domain.Bounty{
			{ID: 2, Repo: "acme/ghost"},
			{ID: 1, Repo: "acme/real"},
		},
		unresolvable: map[string]bool{"acme/ghost": true},
	}

	rec := serve(t, f, http.MethodGet, "/api/v1/bounties")
	var body struct {
		Bounties []struct {
			Repo string `json:"repo"`
		} `json:"bounties"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(body.Bounties) != 1 || body.Bounties[0].Repo != "acme/real" {
		t.Fatalf("expected only the resolvable repo, got %+v", body.Bounties)
	}

	// ?include=all keeps the data auditable.
	rec = serve(t, f, http.MethodGet, "/api/v1/bounties?include=all")
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(body.Bounties) != 2 {
		t.Fatalf("include=all should return every bounty, got %d", len(body.Bounties))
	}
}

// Regression: the repo param lands in a GitHub API path the server calls with
// its own token, so a value that walks out of /repos/ must be rejected at the
// boundary. Counting slashes let "../user" through.
func TestValidRepo(t *testing.T) {
	valid := []string{"FjrREPO/gitbounty", "wevm/viem", "a/b", "org.name/repo-name_1"}
	for _, s := range valid {
		if !validRepo(s) {
			t.Errorf("validRepo(%q) = false, want true", s)
		}
	}
	invalid := []string{
		"", "noslash", "a/b/c", "../user", "a/..", "./x", "a/", "/b",
		"a b/c", "a/c?x=1", "a%2Fb/c", "..%2Fuser/x", "a/c#frag",
	}
	for _, s := range invalid {
		if validRepo(s) {
			t.Errorf("validRepo(%q) = true, want false", s)
		}
	}
}
