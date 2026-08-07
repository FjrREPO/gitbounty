// Package handler contains the HTTP handlers. They read exclusively from
// the SQLite store — never from the chain or the indexer.
package handler

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/FjrREPO/gitbounty/apps/api/internal/domain"
	"github.com/FjrREPO/gitbounty/apps/api/internal/providers"
	"github.com/FjrREPO/gitbounty/apps/api/internal/store"
)

// BountyStore is the read surface the handlers need.
type BountyStore interface {
	ListBounties(ctx context.Context) ([]domain.Bounty, error)
	GetBounty(ctx context.Context, id uint64) (domain.Bounty, error)
	LastSyncedAt(ctx context.Context) (time.Time, error)
	GitHubMeta(ctx context.Context, repo string, issueNumber uint64) (domain.GitHubMeta, error)
	UnresolvableRepos(ctx context.Context) (map[string]bool, error)
}

// EnrichedBounty is a bounty with its cached GitHub metadata attached.
type EnrichedBounty struct {
	domain.Bounty
	GitHub *domain.GitHubMeta `json:"github,omitempty"`
}

// MetaProvider fetches GitHub metadata, refreshing stale entries on demand.
type MetaProvider interface {
	Meta(ctx context.Context, repo string, issueNumber uint64) (domain.GitHubMeta, error)
}

// Handler serves the REST API.
type Handler struct {
	store BountyStore
	meta  MetaProvider
	log   *slog.Logger
}

// New builds a Handler. meta may be nil, in which case GitHub metadata is
// served from the store only (no on-demand fetching).
func New(st BountyStore, meta MetaProvider, log *slog.Logger) *Handler {
	return &Handler{store: st, meta: meta, log: log}
}

// githubMeta prefers the on-demand provider so a repo the syncer has not
// enriched yet still resolves on first view.
func (h *Handler) githubMeta(ctx context.Context, repo string, issueNumber uint64) (domain.GitHubMeta, error) {
	if h.meta != nil {
		return h.meta.Meta(ctx, repo, issueNumber)
	}
	return h.store.GitHubMeta(ctx, repo, issueNumber)
}

func (h *Handler) enrich(ctx context.Context, bounty domain.Bounty) EnrichedBounty {
	enriched := EnrichedBounty{Bounty: bounty}
	meta, err := h.githubMeta(ctx, bounty.Repo, bounty.IssueNumber)
	if err == nil && (meta.Repo != nil || meta.Issue != nil || len(meta.Contributors) > 0) {
		enriched.GitHub = &meta
	}
	return enriched
}

// Health reports service and sync status.
func (h *Handler) Health(w http.ResponseWriter, r *http.Request) {
	syncedAt, err := h.store.LastSyncedAt(r.Context())
	if err != nil {
		h.error(w, http.StatusInternalServerError, "health check failed")
		return
	}
	payload := map[string]any{"status": "ok"}
	if !syncedAt.IsZero() {
		payload["lastSyncedAt"] = syncedAt.Format(time.RFC3339)
	}
	h.json(w, http.StatusOK, payload)
}

// ListBounties returns every bounty, newest first, with GitHub metadata.
func (h *Handler) ListBounties(w http.ResponseWriter, r *http.Request) {
	bounties, err := h.store.ListBounties(r.Context())
	if err != nil {
		h.log.Error("list bounties", "error", err)
		h.error(w, http.StatusInternalServerError, "failed to list bounties")
		return
	}
	// Bounties whose repository does not exist on GitHub can never be
	// claimed; hide them unless the caller explicitly asks for everything.
	hidden := map[string]bool{}
	if r.URL.Query().Get("include") != "all" {
		if unresolvable, err := h.store.UnresolvableRepos(r.Context()); err == nil {
			hidden = unresolvable
		}
	}

	enriched := make([]EnrichedBounty, 0, len(bounties))
	for _, bounty := range bounties {
		if hidden[bounty.Repo] {
			continue
		}
		enriched = append(enriched, h.enrich(r.Context(), bounty))
	}
	h.json(w, http.StatusOK, map[string]any{"bounties": enriched})
}

// GetBounty returns one bounty by id.
func (h *Handler) GetBounty(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseUint(r.PathValue("id"), 10, 64)
	if err != nil {
		h.error(w, http.StatusBadRequest, "invalid bounty id")
		return
	}
	bounty, err := h.store.GetBounty(r.Context(), id)
	if errors.Is(err, store.ErrNotFound) {
		h.error(w, http.StatusNotFound, "bounty not found")
		return
	}
	if err != nil {
		h.log.Error("get bounty", "id", id, "error", err)
		h.error(w, http.StatusInternalServerError, "failed to get bounty")
		return
	}
	h.json(w, http.StatusOK, h.enrich(r.Context(), bounty))
}

// repoSegment matches the characters GitHub allows in an owner or repository
// name. Anchored per segment, so a slash can only come from the separator.
var repoSegment = regexp.MustCompile(`^[A-Za-z0-9._-]+$`)

// validRepo reports whether s is a well-formed "owner/name".
//
// This is the trust boundary: the value is pasted straight into a GitHub API
// path that the server calls with its own token, so counting slashes is not
// enough. "../user" has exactly one slash and would walk out of /repos/ into
// whatever endpoint the token can reach.
func validRepo(s string) bool {
	owner, name, found := strings.Cut(s, "/")
	if !found || !repoSegment.MatchString(owner) || !repoSegment.MatchString(name) {
		return false
	}
	// "." and ".." pass the character class but are path segments, not names.
	for _, part := range [2]string{owner, name} {
		if strings.Trim(part, ".") == "" {
			return false
		}
	}
	return true
}

// GitHubMeta serves cached GitHub metadata for an arbitrary repo (+issue),
// so the web can render GitHub identity without its own rate limit.
func (h *Handler) GitHubMeta(w http.ResponseWriter, r *http.Request) {
	repo := r.URL.Query().Get("repo")
	if !validRepo(repo) {
		h.error(w, http.StatusBadRequest, `repo query param must be "owner/name"`)
		return
	}
	var issueNumber uint64
	if raw := r.URL.Query().Get("issue"); raw != "" {
		parsed, err := strconv.ParseUint(raw, 10, 64)
		if err != nil {
			h.error(w, http.StatusBadRequest, "invalid issue number")
			return
		}
		issueNumber = parsed
	}
	meta, err := h.githubMeta(r.Context(), repo, issueNumber)
	if err != nil {
		h.log.Error("github meta", "repo", repo, "error", err)
		h.error(w, http.StatusInternalServerError, "failed to load github metadata")
		return
	}
	h.json(w, http.StatusOK, meta)
}

// ListProviders returns the LLM options for the BYOK model picker.
func (h *Handler) ListProviders(w http.ResponseWriter, _ *http.Request) {
	h.json(w, http.StatusOK, map[string]any{"providers": providers.List()})
}

func (h *Handler) json(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		h.log.Error("encode response", "error", err)
	}
}

func (h *Handler) error(w http.ResponseWriter, status int, message string) {
	h.json(w, status, map[string]string{"error": message})
}
