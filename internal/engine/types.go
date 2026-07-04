package engine

import "adata-backtest-lab/internal/data"

type BacktestRequest struct {
	Code         string  `json:"code"`
	Start        string  `json:"start"`
	End          string  `json:"end"`
	FastMA       int     `json:"fastMA"`
	SlowMA       int     `json:"slowMA"`
	InitialCash  float64 `json:"initialCash"`
	FeeRate      float64 `json:"feeRate"`
	SlippageRate float64 `json:"slippageRate"`
	ForecastDays int     `json:"forecastDays"`
}

type MetricSet struct {
	TotalReturn      float64 `json:"totalReturn"`
	AnnualizedReturn float64 `json:"annualizedReturn"`
	MaxDrawdown      float64 `json:"maxDrawdown"`
	Sharpe           float64 `json:"sharpe"`
	WinRate          float64 `json:"winRate"`
	ProfitFactor     float64 `json:"profitFactor"`
	TradeCount       int     `json:"tradeCount"`
	Exposure         float64 `json:"exposure"`
}

type IndicatorBar struct {
	data.Bar
	FastMA        float64 `json:"fastMA"`
	SlowMA        float64 `json:"slowMA"`
	MA20          float64 `json:"ma20"`
	MA60          float64 `json:"ma60"`
	BollMid       float64 `json:"bollMid"`
	BollUpper     float64 `json:"bollUpper"`
	BollLower     float64 `json:"bollLower"`
	RSI14         float64 `json:"rsi14"`
	MACD          float64 `json:"macd"`
	MACDSignal    float64 `json:"macdSignal"`
	MACDHist      float64 `json:"macdHist"`
	ATR14         float64 `json:"atr14"`
	VolumeRatio20 float64 `json:"volumeRatio20"`
	Signal        int     `json:"signal"`
	Drawdown      float64 `json:"drawdown"`
	Equity        float64 `json:"equity"`
}

type Trade struct {
	EntryDate  string  `json:"entryDate"`
	ExitDate   string  `json:"exitDate"`
	EntryPrice float64 `json:"entryPrice"`
	ExitPrice  float64 `json:"exitPrice"`
	Shares     float64 `json:"shares"`
	PnL        float64 `json:"pnl"`
	Return     float64 `json:"return"`
	BarsHeld   int     `json:"barsHeld"`
	Reason     string  `json:"reason"`
}

type ForecastPoint struct {
	Date      string  `json:"date"`
	MeanClose float64 `json:"meanClose"`
	P20       float64 `json:"p20"`
	P80       float64 `json:"p80"`
	P10       float64 `json:"p10"`
	P90       float64 `json:"p90"`
	ProbUp    float64 `json:"probUp"`
}

type ForecastSummary struct {
	Horizon           int             `json:"horizon"`
	SampleCount       int             `json:"sampleCount"`
	WalkForwardCount  int             `json:"walkForwardCount"`
	MAE               float64         `json:"mae"`
	DirectionAccuracy float64         `json:"directionAccuracy"`
	ExpectedReturn    float64         `json:"expectedReturn"`
	ProbPositive      float64         `json:"probPositive"`
	Points            []ForecastPoint `json:"points"`
}

type Advice struct {
	Action          string   `json:"action"`
	ActionLabel     string   `json:"actionLabel"`
	Confidence      int      `json:"confidence"`
	PositionHint    string   `json:"positionHint"`
	SuggestedShares int      `json:"suggestedShares"`
	EstimatedCost   float64  `json:"estimatedCost"`
	LastClose       float64  `json:"lastClose"`
	BuyLow          float64  `json:"buyLow"`
	BuyHigh         float64  `json:"buyHigh"`
	ConfirmLine     float64  `json:"confirmLine"`
	NoChaseLine     float64  `json:"noChaseLine"`
	StopLoss        float64  `json:"stopLoss"`
	HardStop        float64  `json:"hardStop"`
	TakeProfit1     float64  `json:"takeProfit1"`
	TakeProfit2     float64  `json:"takeProfit2"`
	RiskReward      float64  `json:"riskReward"`
	TrendScore      int      `json:"trendScore"`
	RiskScore       int      `json:"riskScore"`
	ForecastScore   int      `json:"forecastScore"`
	EntryPlan       []string `json:"entryPlan"`
	Reasons         []string `json:"reasons"`
	Warnings        []string `json:"warnings"`
}

type BacktestResponse struct {
	Request  BacktestRequest `json:"request"`
	Bars     []IndicatorBar  `json:"bars"`
	Trades   []Trade         `json:"trades"`
	Metrics  MetricSet       `json:"metrics"`
	Forecast ForecastSummary `json:"forecast"`
	Advice   Advice          `json:"advice"`
}
