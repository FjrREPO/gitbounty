// Package sync keeps the SQLite store in step with the bounty source
// (the Goldsky indexer, or RPC as a fallback).
package sync

import (
	"context"
	"log/slog"
	"time"

	"github.com/FjrREPO/gitbounty/apps/api/internal/domain"
	"github.com/FjrREPO/gitbounty/apps/api/internal/store"
)

// Source produces the full bounty snapshot to persist.
type Source interface {
	FetchAll(ctx context.Context) ([]domain.Bounty, error)
}

// Syncer periodically refreshes the store from the source.
type Syncer struct {
	source   Source
	store    *store.Store
	interval time.Duration
	log      *slog.Logger
	// AfterSync runs after each successful refresh (e.g. GitHub enrichment).
	AfterSync func(ctx context.Context, bounties []domain.Bounty)
}

// New builds a Syncer.
func New(source Source, st *store.Store, interval time.Duration, log *slog.Logger) *Syncer {
	return &Syncer{source: source, store: st, interval: interval, log: log}
}

// Once performs a single refresh.
func (s *Syncer) Once(ctx context.Context) error {
	bounties, err := s.source.FetchAll(ctx)
	if err != nil {
		return err
	}
	if err := s.store.ReplaceBounties(ctx, bounties, time.Now().UTC()); err != nil {
		return err
	}
	s.log.Info("synced bounties", "count", len(bounties))
	if s.AfterSync != nil {
		s.AfterSync(ctx, bounties)
	}
	return nil
}

// Run refreshes immediately and then on every interval until ctx ends.
func (s *Syncer) Run(ctx context.Context) {
	if err := s.Once(ctx); err != nil {
		s.log.Error("initial sync failed", "error", err)
	}
	ticker := time.NewTicker(s.interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := s.Once(ctx); err != nil {
				s.log.Error("sync failed", "error", err)
			}
		}
	}
}
