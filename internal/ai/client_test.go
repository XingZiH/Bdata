package ai

import (
	"testing"
	"time"
)

func TestConfigFromEnvUsesLocalOpDefaults(t *testing.T) {
	t.Setenv("LOCAL_OP_BASE_URL", "")
	t.Setenv("LOCAL_OP_MODEL", "")
	t.Setenv("LOCAL_OP_API_KEY", "")

	cfg := ConfigFromEnv()

	if cfg.BaseURL != "http://192.168.0.109:50990/v1" {
		t.Fatalf("BaseURL = %q", cfg.BaseURL)
	}
	if cfg.Model != "gpt-5.5" {
		t.Fatalf("Model = %q", cfg.Model)
	}
	if cfg.Timeout != 90*time.Second {
		t.Fatalf("Timeout = %s", cfg.Timeout)
	}
}

func TestBuildPromptIncludesRiskGuardrailsAndMarketContext(t *testing.T) {
	req := AnalysisRequest{
		Code: "002185",
		Name: "华天科技",
		Mode: "watch",
		Context: map[string]any{
			"latest": map[string]any{"close": 12.34, "changePct": 1.2},
			"advice": map[string]any{"actionLabel": "等确认"},
		},
	}

	system, user, err := BuildPrompt(req)
	if err != nil {
		t.Fatalf("BuildPrompt returned error: %v", err)
	}
	if system == "" || user == "" {
		t.Fatalf("system/user prompt should not be empty")
	}
	if !containsAll(user, "002185", "华天科技", "实时盯盘", "未来函数", "风险") {
		t.Fatalf("prompt missing required context: %s", user)
	}
}

func containsAll(text string, parts ...string) bool {
	for _, part := range parts {
		if !contains(text, part) {
			return false
		}
	}
	return true
}

func contains(text string, part string) bool {
	return len(part) == 0 || (len(text) >= len(part) && index(text, part) >= 0)
}

func index(text string, part string) int {
	for i := 0; i+len(part) <= len(text); i++ {
		if text[i:i+len(part)] == part {
			return i
		}
	}
	return -1
}
