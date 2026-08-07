package config

import (
	"testing"
	"time"
)

func env(values map[string]string) func(string) string {
	return func(key string) string { return values[key] }
}

func TestLoadDefaults(t *testing.T) {
	cfg, err := Load(env(nil))
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if cfg.Port != 8080 || cfg.DatabasePath != "gitbounty.db" || cfg.SyncInterval != 30*time.Second {
		t.Fatalf("unexpected defaults: %+v", cfg)
	}
	if cfg.EscrowAddress != "0xa8adefe2c8f0f71a585a73c1259997f593f9e463" {
		t.Fatalf("unexpected escrow default: %s", cfg.EscrowAddress)
	}
}

func TestLoadOverrides(t *testing.T) {
	cfg, err := Load(env(map[string]string{
		"PORT":          "9000",
		"DATABASE_PATH": "/tmp/test.db",
		"SUBGRAPH_URL":  "https://api.goldsky.com/api/public/x/subgraphs/gitbounty/1.0.0/gn",
		"SYNC_INTERVAL": "1m",
	}))
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if cfg.Port != 9000 || cfg.SubgraphURL == "" || cfg.SyncInterval != time.Minute {
		t.Fatalf("overrides not applied: %+v", cfg)
	}
}

func TestLoadRejectsInvalidValues(t *testing.T) {
	if _, err := Load(env(map[string]string{"PORT": "not-a-port"})); err == nil {
		t.Fatal("expected PORT error")
	}
	if _, err := Load(env(map[string]string{"SYNC_INTERVAL": "-5s"})); err == nil {
		t.Fatal("expected SYNC_INTERVAL error")
	}
}
