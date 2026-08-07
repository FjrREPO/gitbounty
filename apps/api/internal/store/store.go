// Package store persists indexed bounties in SQLite so serving traffic
// never touches the RPC or the indexer directly.
package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	_ "modernc.org/sqlite"

	"github.com/FjrREPO/gitbounty/apps/api/internal/domain"
)

// ErrNotFound is returned when a bounty does not exist in the store.
var ErrNotFound = errors.New("bounty not found")

const schema = `
CREATE TABLE IF NOT EXISTS bounties (
    id               INTEGER PRIMARY KEY,
    repo             TEXT    NOT NULL,
    issue_number     INTEGER NOT NULL,
    funder           TEXT    NOT NULL,
    amount_wei       TEXT    NOT NULL,
    reward_usd_cents INTEGER NOT NULL,
    status           TEXT    NOT NULL,
    expires_at       INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bounties_status ON bounties (status);

CREATE TABLE IF NOT EXISTS sync_state (
    key       TEXT PRIMARY KEY,
    synced_at INTEGER NOT NULL
);
`

// Store is a SQLite-backed bounty repository.
type Store struct {
	db *sql.DB
}

// Open opens (and migrates) the SQLite database at path.
// Use ":memory:" for tests.
func Open(path string) (*Store, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}
	// SQLite handles one writer at a time; keep the pool honest.
	db.SetMaxOpenConns(1)
	if _, err := db.Exec(schema); err != nil {
		return nil, fmt.Errorf("migrate: %w", err)
	}
	st := &Store{db: db}
	if err := st.migrateGitHub(); err != nil {
		return nil, fmt.Errorf("migrate github tables: %w", err)
	}
	return st, nil
}

// Close closes the underlying database.
func (s *Store) Close() error {
	return s.db.Close()
}

// ReplaceBounties transactionally replaces the bounty set with the given
// snapshot and records the sync time.
func (s *Store) ReplaceBounties(ctx context.Context, bounties []domain.Bounty, syncedAt time.Time) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	if _, err := tx.ExecContext(ctx, `DELETE FROM bounties`); err != nil {
		return fmt.Errorf("clear bounties: %w", err)
	}
	insert, err := tx.PrepareContext(ctx, `
		INSERT INTO bounties (id, repo, issue_number, funder, amount_wei, reward_usd_cents, status, expires_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
	if err != nil {
		return fmt.Errorf("prepare insert: %w", err)
	}
	defer insert.Close()

	for _, b := range bounties {
		if _, err := insert.ExecContext(ctx,
			b.ID, b.Repo, b.IssueNumber, b.Funder, b.AmountWei, b.RewardUsdCents, string(b.Status), b.ExpiresAt,
		); err != nil {
			return fmt.Errorf("insert bounty %d: %w", b.ID, err)
		}
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO sync_state (key, synced_at) VALUES ('bounties', ?)
		ON CONFLICT (key) DO UPDATE SET synced_at = excluded.synced_at`,
		syncedAt.Unix(),
	); err != nil {
		return fmt.Errorf("record sync time: %w", err)
	}
	return tx.Commit()
}

// ListBounties returns every stored bounty, newest first.
func (s *Store) ListBounties(ctx context.Context) ([]domain.Bounty, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, repo, issue_number, funder, amount_wei, reward_usd_cents, status, expires_at
		FROM bounties ORDER BY id DESC`)
	if err != nil {
		return nil, fmt.Errorf("list bounties: %w", err)
	}
	defer rows.Close()

	bounties := []domain.Bounty{}
	for rows.Next() {
		var b domain.Bounty
		var status string
		if err := rows.Scan(&b.ID, &b.Repo, &b.IssueNumber, &b.Funder, &b.AmountWei, &b.RewardUsdCents, &status, &b.ExpiresAt); err != nil {
			return nil, fmt.Errorf("scan bounty: %w", err)
		}
		b.Status = domain.Status(status)
		bounties = append(bounties, b)
	}
	return bounties, rows.Err()
}

// GetBounty returns a single bounty or ErrNotFound.
func (s *Store) GetBounty(ctx context.Context, id uint64) (domain.Bounty, error) {
	var b domain.Bounty
	var status string
	err := s.db.QueryRowContext(ctx, `
		SELECT id, repo, issue_number, funder, amount_wei, reward_usd_cents, status, expires_at
		FROM bounties WHERE id = ?`, id,
	).Scan(&b.ID, &b.Repo, &b.IssueNumber, &b.Funder, &b.AmountWei, &b.RewardUsdCents, &status, &b.ExpiresAt)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.Bounty{}, ErrNotFound
	}
	if err != nil {
		return domain.Bounty{}, fmt.Errorf("get bounty: %w", err)
	}
	b.Status = domain.Status(status)
	return b, nil
}

// LastSyncedAt reports when bounties were last refreshed (zero if never).
func (s *Store) LastSyncedAt(ctx context.Context) (time.Time, error) {
	var unix int64
	err := s.db.QueryRowContext(ctx,
		`SELECT synced_at FROM sync_state WHERE key = 'bounties'`).Scan(&unix)
	if errors.Is(err, sql.ErrNoRows) {
		return time.Time{}, nil
	}
	if err != nil {
		return time.Time{}, fmt.Errorf("last synced: %w", err)
	}
	return time.Unix(unix, 0).UTC(), nil
}
