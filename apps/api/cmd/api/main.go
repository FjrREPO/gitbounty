// Command api serves the GitBounty REST API: bounties indexed from the
// Goldsky subgraph (or RPC fallback) into SQLite, plus the LLM provider
// catalog for the BYOK model picker.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/FjrREPO/gitbounty/apps/api/internal/chain"
	"github.com/FjrREPO/gitbounty/apps/api/internal/config"
	"github.com/FjrREPO/gitbounty/apps/api/internal/enrich"
	"github.com/FjrREPO/gitbounty/apps/api/internal/github"
	"github.com/FjrREPO/gitbounty/apps/api/internal/handler"
	"github.com/FjrREPO/gitbounty/apps/api/internal/indexer"
	"github.com/FjrREPO/gitbounty/apps/api/internal/server"
	"github.com/FjrREPO/gitbounty/apps/api/internal/store"
	syncer "github.com/FjrREPO/gitbounty/apps/api/internal/sync"
)

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	if err := run(log); err != nil {
		log.Error("fatal", "error", err)
		os.Exit(1)
	}
}

func run(log *slog.Logger) error {
	if err := config.LoadDotEnv(".env"); err != nil {
		log.Warn("could not read .env", "error", err)
	}
	cfg, err := config.FromEnv()
	if err != nil {
		return err
	}

	st, err := store.Open(cfg.DatabasePath)
	if err != nil {
		return err
	}
	defer st.Close()

	source, cleanup, err := bountySource(cfg, log)
	if err != nil {
		return err
	}
	defer cleanup()

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	enricher := enrich.New(github.NewClient(cfg.GitHubToken), st, 15*time.Minute, log)
	sync := syncer.New(source, st, cfg.SyncInterval, log)
	sync.AfterSync = enricher.EnrichAll
	go sync.Run(ctx)

	srv := server.New(cfg.Port, handler.New(st, enricher, log), log)
	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = srv.Shutdown(shutdownCtx)
	}()

	log.Info("listening", "port", cfg.Port, "source", sourceName(cfg))
	if err := srv.ListenAndServe(); !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}

// bountySource prefers the Goldsky indexer; direct RPC is only a fallback
// for environments where the subgraph is not configured.
func bountySource(cfg config.Config, log *slog.Logger) (syncer.Source, func(), error) {
	if cfg.SubgraphURL != "" {
		return indexer.NewClient(cfg.SubgraphURL), func() {}, nil
	}
	log.Warn("SUBGRAPH_URL not set; falling back to direct RPC reads")
	escrow, err := chain.NewEscrowClient(cfg.RPCURL, cfg.EscrowAddress)
	if err != nil {
		return nil, nil, err
	}
	return escrow, escrow.Close, nil
}

func sourceName(cfg config.Config) string {
	if cfg.SubgraphURL != "" {
		return "goldsky-subgraph"
	}
	return "rpc-fallback"
}
