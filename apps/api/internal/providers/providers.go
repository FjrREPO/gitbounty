// Package providers exposes the LLM options supported by the agent's
// bring-your-own-key flow, mirroring @gitbounty/agent's registry.
package providers

import "github.com/FjrREPO/gitbounty/apps/api/internal/domain"

// List returns the supported providers with their default models.
func List() []domain.Provider {
	return []domain.Provider{
		{Name: "claude", DefaultModel: "claude-opus-5"},
		{Name: "openai", DefaultModel: "gpt-5.1"},
		{Name: "deepseek", DefaultModel: "deepseek-chat"},
		{Name: "qwen", DefaultModel: "qwen3-coder-plus"},
		{Name: "glm", DefaultModel: "glm-4.6"},
		{Name: "kimi", DefaultModel: "kimi-k2-turbo-preview"},
		{Name: "grok", DefaultModel: "grok-code-fast-1"},
		{Name: "gemini", DefaultModel: "gemini-2.5-pro"},
		{Name: "mistral", DefaultModel: "codestral-latest"},
		{Name: "custom"},
	}
}
