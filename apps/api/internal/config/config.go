// Package config loads API configuration from the environment.
package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

// Defaults target the verified Coston2 deployment.
const (
	defaultPort          = 8080
	defaultDatabasePath  = "gitbounty.db"
	defaultRPCURL        = "https://coston2-api.flare.network/ext/C/rpc"
	defaultEscrowAddress = "0xa8adefe2c8f0f71a585a73c1259997f593f9e463"
	defaultSyncInterval  = 30 * time.Second
)

// Config holds everything the API needs to run.
type Config struct {
	Port         int
	DatabasePath string
	// SubgraphURL is the Goldsky GraphQL endpoint. When set, the syncer
	// reads from the indexer; otherwise it falls back to direct RPC.
	SubgraphURL   string
	RPCURL        string
	EscrowAddress string
	SyncInterval  time.Duration
	// GitHubToken raises the GitHub quota to 5000 req/h (optional).
	GitHubToken string
}

// Load reads configuration from env, falling back to Coston2 defaults.
func Load(getenv func(string) string) (Config, error) {
	cfg := Config{
		Port:          defaultPort,
		DatabasePath:  defaultDatabasePath,
		SubgraphURL:   getenv("SUBGRAPH_URL"),
		RPCURL:        defaultRPCURL,
		EscrowAddress: defaultEscrowAddress,
		SyncInterval:  defaultSyncInterval,
		GitHubToken:   getenv("GITHUB_TOKEN"),
	}

	if v := getenv("PORT"); v != "" {
		port, err := strconv.Atoi(v)
		if err != nil || port <= 0 || port > 65535 {
			return Config{}, fmt.Errorf("invalid PORT %q", v)
		}
		cfg.Port = port
	}
	if v := getenv("DATABASE_PATH"); v != "" {
		cfg.DatabasePath = v
	}
	if v := getenv("RPC_URL"); v != "" {
		cfg.RPCURL = v
	}
	if v := getenv("ESCROW_ADDRESS"); v != "" {
		cfg.EscrowAddress = v
	}
	if v := getenv("SYNC_INTERVAL"); v != "" {
		interval, err := time.ParseDuration(v)
		if err != nil || interval <= 0 {
			return Config{}, fmt.Errorf("invalid SYNC_INTERVAL %q", v)
		}
		cfg.SyncInterval = interval
	}
	return cfg, nil
}

// FromEnv is the production loader.
func FromEnv() (Config, error) {
	return Load(os.Getenv)
}
