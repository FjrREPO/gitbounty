package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadDotEnv(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, ".env")
	content := "# comment\n\nPORT=9999\nGITHUB_TOKEN=\"ghp_quoted\"\nMALFORMED\n"
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("write: %v", err)
	}

	t.Setenv("PORT", "1234") // real env must win over the file
	if err := LoadDotEnv(path); err != nil {
		t.Fatalf("load: %v", err)
	}

	if got := os.Getenv("PORT"); got != "1234" {
		t.Errorf("PORT = %q, want existing env to win", got)
	}
	if got := os.Getenv("GITHUB_TOKEN"); got != "ghp_quoted" {
		t.Errorf("GITHUB_TOKEN = %q, want quotes stripped", got)
	}
}

func TestLoadDotEnvMissingFileIsOK(t *testing.T) {
	if err := LoadDotEnv(filepath.Join(t.TempDir(), "absent")); err != nil {
		t.Fatalf("missing file should not error: %v", err)
	}
}
