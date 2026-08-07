package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/FjrREPO/gitbounty/apps/api/internal/domain"
)

const githubSchema = `
CREATE TABLE IF NOT EXISTS repo_stats (
    repo          TEXT PRIMARY KEY,
    description   TEXT NOT NULL,
    language      TEXT NOT NULL,
    stars         INTEGER NOT NULL,
    forks         INTEGER NOT NULL,
    open_issues   INTEGER NOT NULL,
    commits       INTEGER NOT NULL,
    pull_requests INTEGER NOT NULL,
    pushed_at     TEXT NOT NULL,
    fetched_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS repo_contributors (
    repo          TEXT NOT NULL,
    login         TEXT NOT NULL,
    avatar_url    TEXT NOT NULL,
    contributions INTEGER NOT NULL,
    position      INTEGER NOT NULL,
    PRIMARY KEY (repo, login)
);

CREATE TABLE IF NOT EXISTS unresolvable_repos (
    repo       TEXT PRIMARY KEY,
    checked_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS issue_meta (
    repo       TEXT NOT NULL,
    number     INTEGER NOT NULL,
    title      TEXT NOT NULL,
    state      TEXT NOT NULL,
    author     TEXT NOT NULL,
    comments   INTEGER NOT NULL,
    labels     TEXT NOT NULL,
    fetched_at INTEGER NOT NULL,
    PRIMARY KEY (repo, number)
);
`

func (s *Store) migrateGitHub() error {
	_, err := s.db.Exec(githubSchema)
	return err
}

// UpsertRepoStats stores (or refreshes) a repo's statistics.
func (s *Store) UpsertRepoStats(ctx context.Context, stats domain.RepoStats, fetchedAt time.Time) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO repo_stats (repo, description, language, stars, forks, open_issues, commits, pull_requests, pushed_at, fetched_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT (repo) DO UPDATE SET
		    description = excluded.description, language = excluded.language,
		    stars = excluded.stars, forks = excluded.forks,
		    open_issues = excluded.open_issues, commits = excluded.commits,
		    pull_requests = excluded.pull_requests, pushed_at = excluded.pushed_at,
		    fetched_at = excluded.fetched_at`,
		stats.Repo, stats.Description, stats.Language, stats.Stars, stats.Forks,
		stats.OpenIssues, stats.Commits, stats.PullRequests, stats.PushedAt, fetchedAt.Unix(),
	)
	return err
}

// ReplaceContributors swaps a repo's contributor list.
func (s *Store) ReplaceContributors(ctx context.Context, repo string, contributors []domain.Contributor) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	if _, err := tx.ExecContext(ctx, `DELETE FROM repo_contributors WHERE repo = ?`, repo); err != nil {
		return err
	}
	for position, c := range contributors {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO repo_contributors (repo, login, avatar_url, contributions, position)
			VALUES (?, ?, ?, ?, ?)`,
			repo, c.Login, c.AvatarURL, c.Contributions, position,
		); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// UpsertIssueMeta stores (or refreshes) an issue's metadata.
func (s *Store) UpsertIssueMeta(ctx context.Context, repo string, issue domain.IssueMeta, fetchedAt time.Time) error {
	labels, err := json.Marshal(issue.Labels)
	if err != nil {
		return fmt.Errorf("marshal labels: %w", err)
	}
	_, err = s.db.ExecContext(ctx, `
		INSERT INTO issue_meta (repo, number, title, state, author, comments, labels, fetched_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT (repo, number) DO UPDATE SET
		    title = excluded.title, state = excluded.state, author = excluded.author,
		    comments = excluded.comments, labels = excluded.labels, fetched_at = excluded.fetched_at`,
		repo, issue.Number, issue.Title, issue.State, issue.AuthorLogin,
		issue.Comments, string(labels), fetchedAt.Unix(),
	)
	return err
}

// RepoFetchedAt reports when a repo's stats were last refreshed (zero if never).
func (s *Store) RepoFetchedAt(ctx context.Context, repo string) (time.Time, error) {
	var unix int64
	err := s.db.QueryRowContext(ctx, `SELECT fetched_at FROM repo_stats WHERE repo = ?`, repo).Scan(&unix)
	if errors.Is(err, sql.ErrNoRows) {
		return time.Time{}, nil
	}
	if err != nil {
		return time.Time{}, err
	}
	return time.Unix(unix, 0).UTC(), nil
}

// IssueFetchedAt reports when an issue's metadata was last refreshed.
func (s *Store) IssueFetchedAt(ctx context.Context, repo string, number uint64) (time.Time, error) {
	var unix int64
	err := s.db.QueryRowContext(ctx,
		`SELECT fetched_at FROM issue_meta WHERE repo = ? AND number = ?`, repo, number).Scan(&unix)
	if errors.Is(err, sql.ErrNoRows) {
		return time.Time{}, nil
	}
	if err != nil {
		return time.Time{}, err
	}
	return time.Unix(unix, 0).UTC(), nil
}

// GitHubMeta assembles the cached GitHub view for a repo (and optionally an
// issue). Missing parts are simply nil/empty — the API never fails a bounty
// response because GitHub data is absent.
func (s *Store) GitHubMeta(ctx context.Context, repo string, issueNumber uint64) (domain.GitHubMeta, error) {
	meta := domain.GitHubMeta{Contributors: []domain.Contributor{}}

	var stats domain.RepoStats
	err := s.db.QueryRowContext(ctx, `
		SELECT repo, description, language, stars, forks, open_issues, commits, pull_requests, pushed_at
		FROM repo_stats WHERE repo = ?`, repo,
	).Scan(&stats.Repo, &stats.Description, &stats.Language, &stats.Stars, &stats.Forks,
		&stats.OpenIssues, &stats.Commits, &stats.PullRequests, &stats.PushedAt)
	if err == nil {
		meta.Repo = &stats
	} else if !errors.Is(err, sql.ErrNoRows) {
		return meta, err
	}

	rows, err := s.db.QueryContext(ctx, `
		SELECT login, avatar_url, contributions FROM repo_contributors
		WHERE repo = ? ORDER BY position`, repo)
	if err != nil {
		return meta, err
	}
	defer rows.Close()
	for rows.Next() {
		var c domain.Contributor
		if err := rows.Scan(&c.Login, &c.AvatarURL, &c.Contributions); err != nil {
			return meta, err
		}
		meta.Contributors = append(meta.Contributors, c)
	}
	if err := rows.Err(); err != nil {
		return meta, err
	}

	if issueNumber > 0 {
		var issue domain.IssueMeta
		var labels string
		err = s.db.QueryRowContext(ctx, `
			SELECT number, title, state, author, comments, labels
			FROM issue_meta WHERE repo = ? AND number = ?`, repo, issueNumber,
		).Scan(&issue.Number, &issue.Title, &issue.State, &issue.AuthorLogin, &issue.Comments, &labels)
		if err == nil {
			if err := json.Unmarshal([]byte(labels), &issue.Labels); err != nil {
				issue.Labels = []domain.Label{}
			}
			meta.Issue = &issue
		} else if !errors.Is(err, sql.ErrNoRows) {
			return meta, err
		}
	}
	return meta, nil
}

// MarkRepoUnresolvable records that GitHub has no such repository, so its
// bounties can be filtered out of the public list.
func (s *Store) MarkRepoUnresolvable(ctx context.Context, repo string, checkedAt time.Time) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO unresolvable_repos (repo, checked_at) VALUES (?, ?)
		ON CONFLICT (repo) DO UPDATE SET checked_at = excluded.checked_at`,
		repo, checkedAt.Unix())
	return err
}

// ClearRepoUnresolvable removes the marker (the repo resolved again).
func (s *Store) ClearRepoUnresolvable(ctx context.Context, repo string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM unresolvable_repos WHERE repo = ?`, repo)
	return err
}

// UnresolvableRepos lists repositories GitHub could not resolve.
func (s *Store) UnresolvableRepos(ctx context.Context) (map[string]bool, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT repo FROM unresolvable_repos`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	repos := map[string]bool{}
	for rows.Next() {
		var repo string
		if err := rows.Scan(&repo); err != nil {
			return nil, err
		}
		repos[repo] = true
	}
	return repos, rows.Err()
}
