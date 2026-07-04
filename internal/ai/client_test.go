package ai

import (
	"strings"
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

func TestBuildPromptInjectsProfessionalStockSkills(t *testing.T) {
	req := AnalysisRequest{
		Code: "002185",
		Name: "华天科技",
		Mode: "watch",
		Context: map[string]any{
			"latest": map[string]any{"close": 12.34, "changePct": 1.2},
		},
	}

	system, _, err := BuildPrompt(req)
	if err != nil {
		t.Fatalf("BuildPrompt returned error: %v", err)
	}

	for _, want := range []string{
		"中国A股市场短线投顾与量化分析专家",
		"多源资讯交叉验证",
		"100股整数倍",
		"买入/增持/中性/减持/卖出",
		"缠论",
		"5W2H",
		"不得输出 buy()/sell()",
	} {
		if !strings.Contains(system, want) {
			t.Fatalf("system prompt missing %q:\n%s", want, system)
		}
	}
}

func TestBuildPromptAddsSectorDiscoveryWorkflow(t *testing.T) {
	req := AnalysisRequest{
		Code: "A股",
		Name: "本月板块与候选股",
		Mode: "sector",
		Context: map[string]any{
			"filters": map[string]any{"maxPrice": 40},
		},
	}

	system, user, err := BuildPrompt(req)
	if err != nil {
		t.Fatalf("BuildPrompt returned error: %v", err)
	}

	for _, want := range []string{"本月热门板块", "新闻事件", "板块分类", "候选公司"} {
		if !strings.Contains(system+user, want) {
			t.Fatalf("sector prompt missing %q:\nSYSTEM:\n%s\nUSER:\n%s", want, system, user)
		}
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
