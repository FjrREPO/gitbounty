// Package enrich keeps GitHub metadata for indexed bounties cached in the
// store, so the web never calls GitHub from the browser and the server
// spends at most a handful of requests per repo per TTL window.
package enrich

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"github.com/FjrREPO/gitbounty/apps/api/internal/domain"
	"github.com/FjrREPO/gitbounty/apps/api/internal/github"
	"github.com/FjrREPO/gitbounty/apps/api/internal/store"
)

const maxContributors = 8

// Enricher fetches and caches GitHub metadata.
type Enricher struct {
	gh    *github.Client
	store *store.Store
	ttl   time.Duration
	log   *slog.Logger
}

// New builds an Enricher; metadata older than ttl is refreshed.
func New(gh *github.Client, st *store.Store, ttl time.Duration, log *slog.Logger) *Enricher {
	return &Enricher{gh: gh, store: st, ttl: ttl, log: log}
}

// EnrichAll refreshes stale metadata for every repo/issue in the bounty set.
// Called after each bounty sync; failures are logged, never fatal.
func (e *Enricher) EnrichAll(ctx context.Context, bounties []domain.Bounty) {
	seenRepos := map[string]bool{}
	for _, bounty := range bounties {
		if !seenRepos[bounty.Repo] {
			seenRepos[bounty.Repo] = true
			e.refreshRepo(ctx, bounty.Repo)
		}
		e.refreshIssue(ctx, bounty.Repo, bounty.IssueNumber)
	}
}

// Meta returns cached metadata, fetching on-demand when nothing is cached
// yet (first view of a brand-new bounty).
func (e *Enricher) Meta(ctx context.Context, repo string, issueNumber uint64) (domain.GitHubMeta, error) {
	e.refreshRepo(ctx, repo)
	if issueNumber > 0 {
		e.refreshIssue(ctx, repo, issueNumber)
	}
	return e.store.GitHubMeta(ctx, repo, issueNumber)
}

func (e *Enricher) refreshRepo(ctx context.Context, repo string) {
	fetchedAt, err := e.store.RepoFetchedAt(ctx, repo)
	if err != nil || time.Since(fetchedAt) < e.ttl {
		return
	}

	stats, err := e.gh.RepoStats(ctx, repo)
	if err != nil {
		if errors.Is(err, github.ErrNotFound) {
			// A bounty pointing at a non-existent repo can never be claimed;
			// mark it so the list can hide it.
			e.log.Info("repository does not exist on github", "repo", repo)
			if err := e.store.MarkRepoUnresolvable(ctx, repo, time.Now().UTC()); err != nil {
				e.log.Warn("mark unresolvable failed", "repo", repo, "error", err)
			}
			return
		}
		e.log.Warn("github repo fetch failed", "repo", repo, "error", err)
		return
	}
	if err := e.store.ClearRepoUnresolvable(ctx, repo); err != nil {
		e.log.Warn("clear unresolvable failed", "repo", repo, "error", err)
	}
	if err := e.store.UpsertRepoStats(ctx, stats, time.Now().UTC()); err != nil {
		e.log.Warn("store repo stats failed", "repo", repo, "error", err)
		return
	}

	contributors, err := e.gh.Contributors(ctx, repo, maxContributors)
	if err != nil {
		e.log.Warn("github contributors fetch failed", "repo", repo, "error", err)
		return
	}
	if err := e.store.ReplaceContributors(ctx, repo, contributors); err != nil {
		e.log.Warn("store contributors failed", "repo", repo, "error", err)
	}
}

func (e *Enricher) refreshIssue(ctx context.Context, repo string, number uint64) {
	fetchedAt, err := e.store.IssueFetchedAt(ctx, repo, number)
	if err != nil || time.Since(fetchedAt) < e.ttl {
		return
	}

	issue, err := e.gh.Issue(ctx, repo, number)
	if err != nil {
		e.log.Warn("github issue fetch failed", "repo", repo, "issue", number, "error", err)
		return
	}
	if err := e.store.UpsertIssueMeta(ctx, repo, issue, time.Now().UTC()); err != nil {
		e.log.Warn("store issue meta failed", "repo", repo, "issue", number, "error", err)
	}
}
