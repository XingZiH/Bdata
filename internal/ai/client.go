package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"
)

const (
	defaultBaseURL = "http://192.168.0.109:50990/v1"
	defaultModel   = "gpt-5.5"
)

type Config struct {
	BaseURL string        `json:"baseURL"`
	Model   string        `json:"model"`
	APIKey  string        `json:"-"`
	Timeout time.Duration `json:"-"`
}

type Client struct {
	config Config
	http   *http.Client
}

type AnalysisRequest struct {
	Code    string         `json:"code"`
	Name    string         `json:"name"`
	Mode    string         `json:"mode"`
	Context map[string]any `json:"context"`
}

type AnalysisResponse struct {
	Model     string `json:"model"`
	Content   string `json:"content"`
	CreatedAt string `json:"createdAt"`
}

type chatRequest struct {
	Model       string        `json:"model"`
	Messages    []chatMessage `json:"messages"`
	Temperature float64       `json:"temperature"`
	MaxTokens   int           `json:"max_tokens"`
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatResponse struct {
	Choices []struct {
		Message chatMessage `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

func ConfigFromEnv() Config {
	cfg := Config{
		BaseURL: strings.TrimRight(strings.TrimSpace(os.Getenv("LOCAL_OP_BASE_URL")), "/"),
		Model:   strings.TrimSpace(os.Getenv("LOCAL_OP_MODEL")),
		APIKey:  strings.TrimSpace(os.Getenv("LOCAL_OP_API_KEY")),
		Timeout: 90 * time.Second,
	}
	if cfg.BaseURL == "" {
		cfg.BaseURL = defaultBaseURL
	}
	if cfg.Model == "" {
		cfg.Model = defaultModel
	}
	if cfg.APIKey == "" {
		cfg.APIKey = strings.TrimSpace(os.Getenv("OPENAI_API_KEY"))
	}
	return cfg
}

func NewClient(cfg Config) *Client {
	if cfg.BaseURL == "" {
		cfg.BaseURL = defaultBaseURL
	}
	if cfg.Model == "" {
		cfg.Model = defaultModel
	}
	if cfg.Timeout <= 0 {
		cfg.Timeout = 90 * time.Second
	}
	cfg.BaseURL = strings.TrimRight(cfg.BaseURL, "/")
	return &Client{
		config: cfg,
		http:   &http.Client{Timeout: cfg.Timeout},
	}
}

func (c *Client) Config() Config {
	return c.config
}

func (c *Client) Analyze(ctx context.Context, req AnalysisRequest) (AnalysisResponse, error) {
	system, user, err := BuildPrompt(req)
	if err != nil {
		return AnalysisResponse{}, err
	}
	payload := chatRequest{
		Model: c.config.Model,
		Messages: []chatMessage{
			{Role: "system", Content: system},
			{Role: "user", Content: user},
		},
		Temperature: 0.2,
		MaxTokens:   1800,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return AnalysisResponse{}, fmt.Errorf("encode AI request: %w", err)
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.config.BaseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return AnalysisResponse{}, fmt.Errorf("build AI request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	if c.config.APIKey != "" {
		httpReq.Header.Set("Authorization", "Bearer "+c.config.APIKey)
	}
	resp, err := c.http.Do(httpReq)
	if err != nil {
		return AnalysisResponse{}, fmt.Errorf("call local-op AI: %w", err)
	}
	defer resp.Body.Close()

	var decoded chatResponse
	if err := json.NewDecoder(resp.Body).Decode(&decoded); err != nil {
		return AnalysisResponse{}, fmt.Errorf("decode AI response: %w", err)
	}
	if resp.StatusCode >= 400 {
		if decoded.Error != nil && decoded.Error.Message != "" {
			return AnalysisResponse{}, errors.New(decoded.Error.Message)
		}
		return AnalysisResponse{}, fmt.Errorf("AI endpoint returned HTTP %d", resp.StatusCode)
	}
	if len(decoded.Choices) == 0 || strings.TrimSpace(decoded.Choices[0].Message.Content) == "" {
		return AnalysisResponse{}, errors.New("AI response has no content")
	}
	return AnalysisResponse{
		Model:     c.config.Model,
		Content:   strings.TrimSpace(decoded.Choices[0].Message.Content),
		CreatedAt: time.Now().Format(time.RFC3339),
	}, nil
}

func BuildPrompt(req AnalysisRequest) (string, string, error) {
	code := strings.TrimSpace(req.Code)
	if code == "" {
		return "", "", errors.New("code is required")
	}
	mode := strings.TrimSpace(req.Mode)
	if mode == "" {
		mode = "watch"
	}
	contextJSON, err := json.MarshalIndent(req.Context, "", "  ")
	if err != nil {
		return "", "", fmt.Errorf("encode analysis context: %w", err)
	}
	system := systemPromptForMode(mode)
	if mode == "sector" {
		user := fmt.Sprintf(`请对 %s %s 做本月板块趋势和候选股筛选。

要求：
1. 先给出本月主线判断：哪些板块适合继续观察，哪些属于拥挤或兑现风险。
2. 根据用户价格范围、板块偏好、风险偏好和候选股评分，给出优先观察名单。
3. 明确说明：哪些只能观察，哪些可以进入回测，哪些不能追高。
4. 不允许编造上下文之外的新闻；所有结论只能来自结构化上下文。
5. 输出包括“本月方向、优先候选、回避条件、下一步动作”，不要超过650字。

结构化上下文：
%s`, code, strings.TrimSpace(req.Name), string(contextJSON))
		return system, user, nil
	}
	user := fmt.Sprintf(`请对 %s %s 做%s分析。

要求：
1. 先判断实时盯盘状态：强势、震荡、转弱、风险扩大或数据不足。
2. 对照回测建议、最新K线、预测分布和盯盘列表，给出接下来1-3个交易日的观察重点。
3. 明确写出触发条件：继续观察、可试仓、不能追高、止损/退出。
4. 避免未来函数：不要使用上下文里没有出现的未来行情或新闻。
5. 输出包括“结论、关键价格、风险、下一步动作”，不要超过500字。

结构化上下文：
%s`, code, strings.TrimSpace(req.Name), modeLabel(mode), string(contextJSON))
	return system, user, nil
}

func modeLabel(mode string) string {
	switch mode {
	case "watch":
		return "实时盯盘"
	case "review":
		return "盘后复盘"
	case "sector":
		return "本月板块趋势与自动选股"
	default:
		return mode
	}
}
