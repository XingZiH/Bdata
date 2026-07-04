package data

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type ADataProvider struct {
	PythonPath string
	ScriptPath string

	mu          sync.Mutex
	stockCached []Stock
}

func NewADataProvider(root string) *ADataProvider {
	pythonPath := os.Getenv("ADATA_PYTHON")
	if pythonPath == "" {
		pythonPath = "python"
	}
	return &ADataProvider{
		PythonPath: pythonPath,
		ScriptPath: filepath.Join(root, "scripts", "adata_bridge.py"),
	}
}

func (p *ADataProvider) Stocks(query string, limit int) ([]Stock, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if len(p.stockCached) == 0 {
		var payload struct {
			Items []Stock `json:"items"`
		}
		if err := p.runJSON(&payload, "stocks"); err != nil {
			return nil, err
		}
		p.stockCached = payload.Items
	}

	query = strings.TrimSpace(strings.ToLower(query))
	if limit <= 0 {
		limit = 500
	}
	if limit > 6000 {
		limit = 6000
	}
	out := make([]Stock, 0, limit)
	for _, item := range p.stockCached {
		haystack := strings.ToLower(item.Code + " " + item.Name + " " + item.Exchange)
		if query == "" || strings.Contains(haystack, query) {
			out = append(out, item)
			if len(out) >= limit {
				break
			}
		}
	}
	return out, nil
}

func (p *ADataProvider) Market(code string, start string, end string, kType int) ([]Bar, error) {
	code = strings.TrimSpace(code)
	if code == "" {
		return nil, errors.New("stock code is required")
	}
	if start == "" {
		start = "2021-01-01"
	}
	if kType <= 0 {
		kType = 1
	}
	args := []string{"market", "--code", code, "--start", start, "--ktype", fmt.Sprintf("%d", kType)}
	if end != "" {
		args = append(args, "--end", end)
	}
	var payload struct {
		Items []Bar `json:"items"`
	}
	if err := p.runJSON(&payload, args...); err != nil {
		return nil, err
	}
	if len(payload.Items) == 0 {
		return nil, fmt.Errorf("no market data returned for %s", code)
	}
	return payload.Items, nil
}

func (p *ADataProvider) runJSON(target any, args ...string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()

	cmdArgs := append([]string{p.ScriptPath}, args...)
	cmd := exec.CommandContext(ctx, p.PythonPath, cmdArgs...)
	cmd.Env = append(os.Environ(), "PYTHONIOENCODING=utf-8")
	var stdout bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("adata bridge failed: %w: %s", err, strings.TrimSpace(stderr.String()))
	}
	if err := json.Unmarshal(stdout.Bytes(), target); err != nil {
		return fmt.Errorf("decode adata bridge JSON: %w; output=%s", err, stdout.String())
	}
	return nil
}
