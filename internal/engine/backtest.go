package engine

import (
	"math"
	"sort"
	"strconv"

	"adata-backtest-lab/internal/data"
)

func RunBacktest(req BacktestRequest, bars []data.Bar) BacktestResponse {
	req = normalizeRequest(req)
	indicators := enrichBars(bars, req.FastMA, req.SlowMA)
	trades, equity := simulate(indicators, req)
	for i := range indicators {
		if i < len(equity) {
			indicators[i].Equity = equity[i]
		}
	}
	applyDrawdown(indicators)
	forecast := Forecast(indicators, req.ForecastDays)
	metrics := calculateMetrics(indicators, trades, req.InitialCash)
	advice := buildAdvice(indicators, metrics, forecast, req)
	return BacktestResponse{
		Request:  req,
		Bars:     indicators,
		Trades:   trades,
		Metrics:  metrics,
		Forecast: forecast,
		Advice:   advice,
	}
}

func normalizeRequest(req BacktestRequest) BacktestRequest {
	if req.FastMA <= 1 {
		req.FastMA = 5
	}
	if req.SlowMA <= req.FastMA {
		req.SlowMA = 20
	}
	if req.InitialCash <= 0 {
		req.InitialCash = 100000
	}
	if req.FeeRate <= 0 {
		req.FeeRate = 0.0003
	}
	if req.SlippageRate < 0 {
		req.SlippageRate = 0
	}
	if req.ForecastDays <= 0 {
		req.ForecastDays = 3
	}
	if req.ForecastDays > 10 {
		req.ForecastDays = 10
	}
	return req
}

func enrichBars(bars []data.Bar, fast int, slow int) []IndicatorBar {
	out := make([]IndicatorBar, len(bars))
	closes := make([]float64, len(bars))
	highs := make([]float64, len(bars))
	lows := make([]float64, len(bars))
	volumes := make([]float64, len(bars))
	for i, bar := range bars {
		out[i] = IndicatorBar{Bar: bar}
		closes[i] = bar.Close
		highs[i] = bar.High
		lows[i] = bar.Low
		volumes[i] = bar.Volume
	}
	fastMA := sma(closes, fast)
	slowMA := sma(closes, slow)
	ma20 := sma(closes, 20)
	ma60 := sma(closes, 60)
	bollStd := rollingStd(closes, 20)
	rsi := rsi(closes, 14)
	ema12 := ema(closes, 12)
	ema26 := ema(closes, 26)
	macd := make([]float64, len(closes))
	for i := range macd {
		if ema12[i] > 0 && ema26[i] > 0 {
			macd[i] = ema12[i] - ema26[i]
		}
	}
	macdSignal := ema(macd, 9)
	atr14 := atr(highs, lows, closes, 14)
	volRatio := volumeRatio(volumes, 20)
	for i := range out {
		out[i].FastMA = fastMA[i]
		out[i].SlowMA = slowMA[i]
		out[i].MA20 = ma20[i]
		out[i].MA60 = ma60[i]
		out[i].BollMid = ma20[i]
		if ma20[i] > 0 && bollStd[i] > 0 {
			out[i].BollUpper = ma20[i] + 2*bollStd[i]
			out[i].BollLower = ma20[i] - 2*bollStd[i]
		}
		out[i].RSI14 = rsi[i]
		out[i].MACD = macd[i]
		out[i].MACDSignal = macdSignal[i]
		out[i].MACDHist = macd[i] - macdSignal[i]
		out[i].ATR14 = atr14[i]
		out[i].VolumeRatio20 = volRatio[i]
		if fastMA[i] > 0 && slowMA[i] > 0 {
			if fastMA[i] > slowMA[i] {
				out[i].Signal = 1
			} else {
				out[i].Signal = -1
			}
		}
	}
	return out
}

func simulate(bars []IndicatorBar, req BacktestRequest) ([]Trade, []float64) {
	equity := make([]float64, len(bars))
	if len(bars) == 0 {
		return nil, equity
	}

	cash := req.InitialCash
	shares := 0.0
	entryPrice := 0.0
	entryDate := ""
	entryIndex := 0
	trades := make([]Trade, 0)

	for i := range bars {
		equity[i] = cash + shares*bars[i].Close
		if i < req.SlowMA || i >= len(bars)-1 {
			continue
		}

		next := bars[i+1]
		if shares == 0 && bars[i].Signal == 1 {
			price := next.Open * (1 + req.SlippageRate)
			if price <= 0 {
				continue
			}
			buyShares := cash / (price * (1 + req.FeeRate))
			if buyShares <= 0 {
				continue
			}
			fee := buyShares * price * req.FeeRate
			cash -= buyShares*price + fee
			shares = buyShares
			entryPrice = price
			entryDate = next.Date
			entryIndex = i + 1
			equity[i+1] = cash + shares*next.Close
			continue
		}

		if shares > 0 && bars[i].Signal == -1 {
			price := next.Open * (1 - req.SlippageRate)
			fee := shares * price * req.FeeRate
			proceeds := shares*price - fee
			pnl := proceeds - shares*entryPrice
			trades = append(trades, Trade{
				EntryDate:  entryDate,
				ExitDate:   next.Date,
				EntryPrice: entryPrice,
				ExitPrice:  price,
				Shares:     shares,
				PnL:        pnl,
				Return:     price/entryPrice - 1,
				BarsHeld:   i + 1 - entryIndex,
				Reason:     "均线死叉",
			})
			cash += proceeds
			shares = 0
			entryPrice = 0
			entryDate = ""
			equity[i+1] = cash
		}
	}

	if shares > 0 {
		last := bars[len(bars)-1]
		price := last.Close
		fee := shares * price * req.FeeRate
		proceeds := shares*price - fee
		pnl := proceeds - shares*entryPrice
		trades = append(trades, Trade{
			EntryDate:  entryDate,
			ExitDate:   last.Date,
			EntryPrice: entryPrice,
			ExitPrice:  price,
			Shares:     shares,
			PnL:        pnl,
			Return:     price/entryPrice - 1,
			BarsHeld:   len(bars) - 1 - entryIndex,
			Reason:     "期末按市价结算",
		})
		equity[len(equity)-1] = cash + proceeds
	}

	lastEquity := req.InitialCash
	for i := range equity {
		if equity[i] <= 0 {
			equity[i] = lastEquity
		}
		lastEquity = equity[i]
	}
	return trades, equity
}

func buildAdvice(bars []IndicatorBar, metrics MetricSet, forecast ForecastSummary, req BacktestRequest) Advice {
	if len(bars) == 0 {
		return Advice{Action: "no_data", ActionLabel: "无数据", PositionHint: "行情样本不足，不能给出交易建议"}
	}
	last := bars[len(bars)-1]
	close := last.Close
	atrValue := last.ATR14
	if atrValue <= 0 {
		atrValue = math.Max((last.High - last.Low), close*0.025)
	}
	if atrValue <= 0 {
		atrValue = math.Max(close*0.025, 0.01)
	}

	trendScore := 0
	riskScore := 0
	forecastScore := 0
	reasons := make([]string, 0, 8)
	warnings := make([]string, 0, 8)

	if last.MA20 > 0 && close > last.MA20 {
		trendScore += 18
		reasons = append(reasons, "收盘价站上20日均线，短期结构偏强")
	} else if last.MA20 > 0 {
		warnings = append(warnings, "收盘价仍在20日均线下方，短线承接不足")
	}
	if last.MA60 > 0 && close > last.MA60 {
		trendScore += 16
		reasons = append(reasons, "收盘价站上60日均线，中期趋势没有完全破坏")
	} else if last.MA60 > 0 {
		warnings = append(warnings, "价格低于60日均线，中期趋势仍需修复")
	}
	if last.FastMA > 0 && last.SlowMA > 0 && last.FastMA > last.SlowMA {
		trendScore += 14
		reasons = append(reasons, "快线在慢线上方，趋势跟随信号有效")
	}
	if last.MACDHist > 0 && last.MACD >= last.MACDSignal {
		trendScore += 14
		reasons = append(reasons, "MACD柱线为正，动能没有转弱")
	} else if last.MACDHist < 0 {
		warnings = append(warnings, "MACD柱线为负，短线动能偏弱")
	}
	if last.RSI14 >= 45 && last.RSI14 <= 68 {
		trendScore += 10
		reasons = append(reasons, "RSI处于中性偏强区间，未明显过热")
	} else if last.RSI14 > 72 {
		riskScore += 20
		warnings = append(warnings, "RSI超过72，追高风险较大")
	} else if last.RSI14 > 0 && last.RSI14 < 38 {
		warnings = append(warnings, "RSI偏弱，反弹确认前不宜重仓")
	}
	if last.VolumeRatio20 > 0.25 {
		trendScore += 8
		reasons = append(reasons, "成交量高于20日均量，资金参与度提升")
	} else if last.VolumeRatio20 < -0.35 {
		warnings = append(warnings, "成交量明显低于20日均量，突破可靠性不足")
	}

	if last.BollUpper > 0 && close > last.BollUpper {
		riskScore += 18
		warnings = append(warnings, "价格触及或突破布林上轨，短线容易回落")
	}
	if close > 0 && atrValue/close > 0.055 {
		riskScore += 15
		warnings = append(warnings, "ATR波动率偏高，止损距离需要放宽")
	}
	if metrics.MaxDrawdown < -0.25 {
		riskScore += 10
		warnings = append(warnings, "历史回撤较深，策略承压时要降低仓位")
	}
	if metrics.TradeCount >= 5 && metrics.ProfitFactor > 0 && metrics.ProfitFactor < 1 {
		riskScore += 12
		warnings = append(warnings, "历史盈亏比小于1，单次入场必须等价格优势")
	}

	switch {
	case forecast.ProbPositive >= 0.60:
		forecastScore = 30
		reasons = append(reasons, "相似样本未来区间上涨概率超过60%")
	case forecast.ProbPositive >= 0.54:
		forecastScore = 22
		reasons = append(reasons, "相似样本未来区间上涨概率略占优")
	case forecast.ProbPositive >= 0.50:
		forecastScore = 14
		reasons = append(reasons, "预测分布接近均衡，适合轻仓观察")
	case forecast.ProbPositive >= 0.45:
		forecastScore = 7
		warnings = append(warnings, "预测上涨概率优势不明显")
	default:
		warnings = append(warnings, "预测上涨概率偏低，不支持主动买入")
	}
	if forecast.WalkForwardCount > 0 && forecast.DirectionAccuracy < 0.48 {
		riskScore += 8
		warnings = append(warnings, "walk-forward方向命中率低于48%，预测权重要降低")
	}

	totalScore := trendScore + forecastScore - riskScore
	action := "avoid"
	label := "观望不买"
	positionHint := "不建议新开仓；只观察确认线是否被放量站上"
	targetRatio := 0.0
	switch {
	case totalScore >= 55 && forecast.ProbPositive >= 0.54 && riskScore < 45:
		action = "buy_pullback"
		label = "回踩买入"
		positionHint = "首笔30%-40%仓位，价格进入买入区后分两笔挂限价"
		targetRatio = 0.35
	case totalScore >= 38 && forecast.ProbPositive >= 0.50:
		action = "trial_buy"
		label = "小仓试买"
		positionHint = "首笔不超过20%仓位，站稳确认线后再加仓"
		targetRatio = 0.20
	case totalScore >= 25:
		action = "wait_confirm"
		label = "等确认"
		positionHint = "暂不追价；只在突破确认线后用10%-15%仓位试单"
		targetRatio = 0.12
	}

	anchor := last.MA20
	if anchor <= 0 {
		anchor = close
	}
	buyHigh := math.Min(close-0.15*atrValue, anchor+0.35*atrValue)
	if buyHigh <= 0 || buyHigh < close*0.88 || buyHigh > close*1.02 {
		buyHigh = close - 0.20*atrValue
	}
	buyLow := buyHigh - 0.75*atrValue
	if buyLow <= 0 {
		buyLow = buyHigh * 0.97
	}
	stopLoss := math.Min(buyLow-0.35*atrValue, buyHigh-1.15*atrValue)
	if stopLoss <= 0 {
		stopLoss = buyHigh * 0.94
	}
	hardStop := stopLoss - 0.50*atrValue
	if hardStop <= 0 {
		hardStop = stopLoss * 0.98
	}
	confirmLine := math.Max(close+0.25*atrValue, anchor+1.00*atrValue)
	if last.BollUpper > 0 {
		confirmLine = math.Max(confirmLine, last.BollUpper-0.20*atrValue)
	}
	noChaseLine := math.Max(confirmLine+0.60*atrValue, close+1.10*atrValue)

	riskPerShare := math.Max(buyHigh-stopLoss, atrValue)
	takeProfit1 := buyHigh + 1.35*riskPerShare
	takeProfit2 := buyHigh + 2.10*riskPerShare
	if len(forecast.Points) > 0 {
		lastPoint := forecast.Points[len(forecast.Points)-1]
		if lastPoint.P80 > buyHigh {
			takeProfit1 = math.Max(takeProfit1, lastPoint.P80)
		}
		if lastPoint.P90 > buyHigh {
			takeProfit2 = math.Max(takeProfit2, lastPoint.P90)
		}
	}
	riskReward := 0.0
	if buyHigh > stopLoss {
		riskReward = (takeProfit1 - buyHigh) / (buyHigh - stopLoss)
	}

	suggestedShares := 0
	estimatedCost := 0.0
	minLotCost := buyHigh * 100 * (1 + req.FeeRate)
	if targetRatio > 0 && buyHigh > 0 && req.InitialCash > 0 {
		targetBudget := req.InitialCash * targetRatio
		suggestedShares = int(math.Floor(targetBudget/buyHigh/100.0)) * 100
		if suggestedShares == 0 && req.InitialCash >= minLotCost {
			suggestedShares = 100
			warnings = append(warnings, "A股最小交易单位为100股，本次最小下单会高于目标仓位")
		}
		estimatedCost = float64(suggestedShares) * buyHigh * (1 + req.FeeRate)
	}

	entryPlan := []string{
		"只在买入区内挂限价，不在不追线上方追单",
		"第一笔成交后，以止损线作为风控；跌破硬止损必须退出",
		"价格站上确认线且量能不低于20日均量，再考虑加仓",
		"止盈1先减仓，止盈2只保留趋势仓",
	}
	if action == "avoid" {
		entryPlan = []string{
			"不开新仓，等待价格重新站上确认线",
			"若放量突破确认线，可重新运行回测再评估",
			"跌破硬止损区域说明结构继续走弱，不做摊平",
		}
	}
	if targetRatio > 0 && req.InitialCash > 0 && minLotCost > req.InitialCash {
		action = "cash_not_enough"
		label = "资金不足"
		positionHint = "当前资金不足以买入A股最小单位100股；先不下单，增加资金或换低价标的"
		estimatedCost = 0
		suggestedShares = 0
		warnings = append(warnings, "按买入上沿估算，买100股至少需要约"+formatMoneyText(minLotCost)+"元")
		entryPlan = []string{
			"不提交买入委托，因为资金不足以覆盖100股和交易费用",
			"若补足资金，只在买入区内挂限价",
			"补足资金后重新运行回测，使用新的止损和止盈价位",
		}
	}

	confidence := clampInt(40+trendScore/2+forecastScore-riskScore/2, 12, 88)
	return Advice{
		Action:          action,
		ActionLabel:     label,
		Confidence:      confidence,
		PositionHint:    positionHint,
		SuggestedShares: suggestedShares,
		EstimatedCost:   round2(estimatedCost),
		LastClose:       round2(close),
		BuyLow:          round2(buyLow),
		BuyHigh:         round2(buyHigh),
		ConfirmLine:     round2(confirmLine),
		NoChaseLine:     round2(noChaseLine),
		StopLoss:        round2(stopLoss),
		HardStop:        round2(hardStop),
		TakeProfit1:     round2(takeProfit1),
		TakeProfit2:     round2(takeProfit2),
		RiskReward:      round2(riskReward),
		TrendScore:      trendScore,
		RiskScore:       riskScore,
		ForecastScore:   forecastScore,
		EntryPlan:       entryPlan,
		Reasons:         reasons,
		Warnings:        warnings,
	}
}

func calculateMetrics(bars []IndicatorBar, trades []Trade, initialCash float64) MetricSet {
	if len(bars) == 0 || initialCash <= 0 {
		return MetricSet{}
	}
	finalEquity := bars[len(bars)-1].Equity
	totalReturn := finalEquity/initialCash - 1
	years := math.Max(float64(len(bars))/252.0, 1.0/252.0)
	annualized := math.Pow(1+totalReturn, 1/years) - 1

	returns := make([]float64, 0, len(bars)-1)
	exposedDays := 0
	for i := 1; i < len(bars); i++ {
		if bars[i-1].Equity > 0 {
			returns = append(returns, bars[i].Equity/bars[i-1].Equity-1)
		}
		if bars[i].Signal == 1 {
			exposedDays++
		}
	}

	winCount := 0
	grossProfit := 0.0
	grossLoss := 0.0
	for _, trade := range trades {
		if trade.PnL >= 0 {
			winCount++
			grossProfit += trade.PnL
		} else {
			grossLoss += math.Abs(trade.PnL)
		}
	}
	winRate := 0.0
	if len(trades) > 0 {
		winRate = float64(winCount) / float64(len(trades))
	}
	profitFactor := 0.0
	if grossLoss > 0 {
		profitFactor = grossProfit / grossLoss
	} else if grossProfit > 0 {
		profitFactor = 99
	}

	return MetricSet{
		TotalReturn:      totalReturn,
		AnnualizedReturn: annualized,
		MaxDrawdown:      maxDrawdown(bars),
		Sharpe:           sharpe(returns),
		WinRate:          winRate,
		ProfitFactor:     profitFactor,
		TradeCount:       len(trades),
		Exposure:         float64(exposedDays) / math.Max(float64(len(bars)), 1),
	}
}

func applyDrawdown(bars []IndicatorBar) {
	peak := 0.0
	for i := range bars {
		if bars[i].Equity > peak {
			peak = bars[i].Equity
		}
		if peak > 0 {
			bars[i].Drawdown = bars[i].Equity/peak - 1
		}
	}
}

func maxDrawdown(bars []IndicatorBar) float64 {
	minDD := 0.0
	for _, bar := range bars {
		if bar.Drawdown < minDD {
			minDD = bar.Drawdown
		}
	}
	return minDD
}

func sharpe(returns []float64) float64 {
	if len(returns) < 2 {
		return 0
	}
	mean := average(returns)
	variance := 0.0
	for _, value := range returns {
		d := value - mean
		variance += d * d
	}
	std := math.Sqrt(variance / float64(len(returns)-1))
	if std == 0 {
		return 0
	}
	return mean / std * math.Sqrt(252)
}

func sma(values []float64, window int) []float64 {
	out := make([]float64, len(values))
	if window <= 0 {
		return out
	}
	sum := 0.0
	for i, value := range values {
		sum += value
		if i >= window {
			sum -= values[i-window]
		}
		if i >= window-1 {
			out[i] = sum / float64(window)
		}
	}
	return out
}

func ema(values []float64, window int) []float64 {
	out := make([]float64, len(values))
	if window <= 0 || len(values) == 0 {
		return out
	}
	alpha := 2.0 / float64(window+1)
	out[0] = values[0]
	for i := 1; i < len(values); i++ {
		out[i] = values[i]*alpha + out[i-1]*(1-alpha)
	}
	return out
}

func rollingStd(values []float64, window int) []float64 {
	out := make([]float64, len(values))
	if window <= 1 {
		return out
	}
	for i := window - 1; i < len(values); i++ {
		mean := 0.0
		for j := i - window + 1; j <= i; j++ {
			mean += values[j]
		}
		mean /= float64(window)
		variance := 0.0
		for j := i - window + 1; j <= i; j++ {
			d := values[j] - mean
			variance += d * d
		}
		out[i] = math.Sqrt(variance / float64(window))
	}
	return out
}

func atr(highs []float64, lows []float64, closes []float64, window int) []float64 {
	out := make([]float64, len(closes))
	if window <= 0 || len(closes) == 0 {
		return out
	}
	tr := make([]float64, len(closes))
	for i := range closes {
		highLow := highs[i] - lows[i]
		if i == 0 {
			tr[i] = highLow
			continue
		}
		tr[i] = math.Max(highLow, math.Max(math.Abs(highs[i]-closes[i-1]), math.Abs(lows[i]-closes[i-1])))
	}
	if len(tr) < window {
		return out
	}
	sum := 0.0
	for i := 0; i < len(tr); i++ {
		sum += tr[i]
		if i < window-1 {
			continue
		}
		if i == window-1 {
			out[i] = sum / float64(window)
			continue
		}
		out[i] = (out[i-1]*float64(window-1) + tr[i]) / float64(window)
	}
	return out
}

func volumeRatio(values []float64, window int) []float64 {
	out := make([]float64, len(values))
	if window <= 0 {
		return out
	}
	sum := 0.0
	for i, value := range values {
		sum += value
		if i >= window {
			sum -= values[i-window]
		}
		if i >= window-1 {
			mean := sum / float64(window)
			if mean > 0 {
				out[i] = value/mean - 1
			}
		}
	}
	return out
}

func rsi(values []float64, window int) []float64 {
	out := make([]float64, len(values))
	if window <= 0 || len(values) <= window {
		return out
	}
	for i := window; i < len(values); i++ {
		gain := 0.0
		loss := 0.0
		for j := i - window + 1; j <= i; j++ {
			diff := values[j] - values[j-1]
			if diff >= 0 {
				gain += diff
			} else {
				loss -= diff
			}
		}
		if loss == 0 {
			out[i] = 100
		} else {
			rs := gain / loss
			out[i] = 100 - 100/(1+rs)
		}
	}
	return out
}

func average(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	sum := 0.0
	for _, value := range values {
		sum += value
	}
	return sum / float64(len(values))
}

func round2(value float64) float64 {
	return math.Round(value*100) / 100
}

func formatMoneyText(value float64) string {
	return strconv.FormatFloat(round2(value), 'f', 2, 64)
}

func clampInt(value int, minValue int, maxValue int) int {
	if value < minValue {
		return minValue
	}
	if value > maxValue {
		return maxValue
	}
	return value
}

func quantile(sorted []float64, q float64) float64 {
	if len(sorted) == 0 {
		return 0
	}
	if q <= 0 {
		return sorted[0]
	}
	if q >= 1 {
		return sorted[len(sorted)-1]
	}
	pos := q * float64(len(sorted)-1)
	low := int(math.Floor(pos))
	high := int(math.Ceil(pos))
	if low == high {
		return sorted[low]
	}
	weight := pos - float64(low)
	return sorted[low]*(1-weight) + sorted[high]*weight
}

func sortedCopy(values []float64) []float64 {
	out := append([]float64(nil), values...)
	sort.Float64s(out)
	return out
}
