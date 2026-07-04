package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	localai "adata-backtest-lab/internal/ai"
	"adata-backtest-lab/internal/data"
	"adata-backtest-lab/internal/engine"
)

type app struct {
	root     string
	provider data.Provider
	ai       *localai.Client
}

func main() {
	addr := flag.String("addr", ":8088", "server address")
	flag.Parse()
	root, err := os.Getwd()
	if err != nil {
		log.Fatal(err)
	}
	a := &app{
		root:     root,
		provider: data.NewADataProvider(root),
		ai:       localai.NewClient(localai.ConfigFromEnv()),
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/api/health", a.handleHealth)
	mux.HandleFunc("/api/stocks", a.handleStocks)
	mux.HandleFunc("/api/market", a.handleMarket)
	mux.HandleFunc("/api/quotes", a.handleQuotes)
	mux.HandleFunc("/api/backtest", a.handleBacktest)
	mux.HandleFunc("/api/ai/config", a.handleAIConfig)
	mux.HandleFunc("/api/ai/analyze", a.handleAIAnalyze)
	mux.Handle("/", http.FileServer(http.Dir(filepath.Join(root, "web"))))

	server := &http.Server{
		Addr:              *addr,
		Handler:           logRequests(mux),
		ReadHeaderTimeout: 10 * time.Second,
	}
	log.Printf("AData Backtest Lab listening on http://localhost%s", *addr)
	log.Fatal(server.ListenAndServe())
}

func (a *app) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "time": time.Now().Format(time.RFC3339)})
}

func (a *app) handleStocks(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	items, err := a.provider.Stocks(query, limit)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (a *app) handleMarket(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	start := r.URL.Query().Get("start")
	end := r.URL.Query().Get("end")
	kType, _ := strconv.Atoi(r.URL.Query().Get("kType"))
	bars, err := a.provider.Market(code, start, end, kType)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"bars": bars})
}

func (a *app) handleQuotes(w http.ResponseWriter, r *http.Request) {
	raw := strings.TrimSpace(r.URL.Query().Get("codes"))
	if raw == "" {
		writeError(w, errors.New("codes is required"))
		return
	}
	parts := strings.Split(raw, ",")
	seen := make(map[string]bool)
	codes := make([]string, 0, len(parts))
	for _, part := range parts {
		code := strings.TrimSpace(part)
		if code == "" || seen[code] {
			continue
		}
		seen[code] = true
		codes = append(codes, code)
		if len(codes) >= 40 {
			break
		}
	}
	start := time.Now().AddDate(0, -6, 0).Format("2006-01-02")
	type quote struct {
		Code      string  `json:"code"`
		Date      string  `json:"date"`
		Price     float64 `json:"price"`
		ChangePct float64 `json:"changePct"`
		Error     string  `json:"error,omitempty"`
	}
	items := make([]quote, len(codes))
	var wg sync.WaitGroup
	sem := make(chan struct{}, 5)
	for index, code := range codes {
		wg.Add(1)
		go func(index int, code string) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			bars, err := a.provider.Market(code, start, "", 1)
			if err != nil {
				items[index] = quote{Code: code, Error: err.Error()}
				return
			}
			last := bars[len(bars)-1]
			changePct := last.ChangePct
			if changePct == 0 && len(bars) > 1 && bars[len(bars)-2].Close > 0 {
				changePct = (last.Close/bars[len(bars)-2].Close - 1) * 100
			}
			items[index] = quote{
				Code:      code,
				Date:      last.Date,
				Price:     last.Close,
				ChangePct: changePct,
			}
		}(index, code)
	}
	wg.Wait()
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (a *app) handleBacktest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, errors.New("POST required"))
		return
	}
	var req engine.BacktestRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, fmt.Errorf("decode request: %w", err))
		return
	}
	if strings.TrimSpace(req.Code) == "" {
		writeError(w, errors.New("code is required"))
		return
	}
	bars, err := a.provider.Market(req.Code, req.Start, req.End, 1)
	if err != nil {
		writeError(w, err)
		return
	}
	resp := engine.RunBacktest(req, bars)
	writeJSON(w, http.StatusOK, resp)
}

func (a *app) handleAIConfig(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, errors.New("GET required"))
		return
	}
	cfg := a.ai.Config()
	writeJSON(w, http.StatusOK, map[string]any{
		"baseURL":          cfg.BaseURL,
		"model":            cfg.Model,
		"enabled":          true,
		"apiKeyConfigured": cfg.APIKey != "",
	})
}

func (a *app) handleAIAnalyze(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, errors.New("POST required"))
		return
	}
	var req localai.AnalysisRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, fmt.Errorf("decode request: %w", err))
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 100*time.Second)
	defer cancel()
	resp, err := a.ai.Analyze(ctx, req)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		log.Printf("write JSON: %v", err)
	}
}

func writeError(w http.ResponseWriter, err error) {
	writeJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error()})
}

func logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s %s", r.Method, r.URL.Path, time.Since(start).Round(time.Millisecond))
	})
}
