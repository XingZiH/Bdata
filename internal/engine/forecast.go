package engine

import (
	"math"
	"sort"
	"time"
)

type featureRow struct {
	index int
	date  string
	x     []float64
	ret   float64
}

func Forecast(bars []IndicatorBar, horizon int) ForecastSummary {
	if horizon <= 0 {
		horizon = 3
	}
	if horizon > 10 {
		horizon = 10
	}
	rows := buildFeatureRows(bars, horizon)
	latest := latestFeature(bars)
	if len(rows) < 80 || len(latest) == 0 || len(bars) == 0 {
		return ForecastSummary{Horizon: horizon}
	}

	wfCount, mae, directionAccuracy := walkForwardForecast(rows)
	k := 80
	if len(rows) < k {
		k = len(rows)
	}
	neighbors := nearestRows(rows, latest, k)
	returns := make([]float64, len(neighbors))
	for i, row := range neighbors {
		returns[i] = row.ret
	}
	sort.Float64s(returns)
	meanReturn := average(returns)
	lastClose := bars[len(bars)-1].Close
	probPositive := 0.0
	for _, value := range returns {
		if value > 0 {
			probPositive++
		}
	}
	probPositive /= float64(len(returns))

	points := make([]ForecastPoint, 0, horizon)
	startDate := parseDate(bars[len(bars)-1].Date)
	for day := 1; day <= horizon; day++ {
		fraction := float64(day) / float64(horizon)
		projected := make([]float64, len(returns))
		upCount := 0
		for i, totalRet := range returns {
			dailyRet := math.Pow(1+totalRet, fraction) - 1
			projected[i] = lastClose * (1 + dailyRet)
			if projected[i] > lastClose {
				upCount++
			}
		}
		sort.Float64s(projected)
		points = append(points, ForecastPoint{
			Date:      nextTradingDate(startDate, day).Format("2006-01-02"),
			MeanClose: lastClose * (1 + meanReturn*fraction),
			P10:       quantile(projected, 0.10),
			P20:       quantile(projected, 0.20),
			P80:       quantile(projected, 0.80),
			P90:       quantile(projected, 0.90),
			ProbUp:    float64(upCount) / float64(len(projected)),
		})
	}

	return ForecastSummary{
		Horizon:           horizon,
		SampleCount:       len(neighbors),
		WalkForwardCount:  wfCount,
		MAE:               mae,
		DirectionAccuracy: directionAccuracy,
		ExpectedReturn:    meanReturn,
		ProbPositive:      probPositive,
		Points:            points,
	}
}

func buildFeatureRows(bars []IndicatorBar, horizon int) []featureRow {
	rows := make([]featureRow, 0)
	for i := 60; i+horizon < len(bars); i++ {
		x := featureAt(bars, i)
		if len(x) == 0 {
			continue
		}
		ret := bars[i+horizon].Close/bars[i].Close - 1
		rows = append(rows, featureRow{index: i, date: bars[i].Date, x: x, ret: ret})
	}
	return rows
}

func latestFeature(bars []IndicatorBar) []float64 {
	if len(bars) < 61 {
		return nil
	}
	return featureAt(bars, len(bars)-1)
}

func featureAt(bars []IndicatorBar, i int) []float64 {
	if i < 60 || bars[i].Close <= 0 {
		return nil
	}
	close := bars[i].Close
	ret1 := close/bars[i-1].Close - 1
	ret3 := close/bars[i-3].Close - 1
	ret5 := close/bars[i-5].Close - 1
	ma20Gap := 0.0
	if bars[i].MA20 > 0 {
		ma20Gap = close/bars[i].MA20 - 1
	}
	ma60Gap := 0.0
	if bars[i].MA60 > 0 {
		ma60Gap = close/bars[i].MA60 - 1
	}
	rangePct := 0.0
	if close > 0 {
		rangePct = (bars[i].High - bars[i].Low) / close
	}
	closePos := 0.5
	if bars[i].High > bars[i].Low {
		closePos = (close - bars[i].Low) / (bars[i].High - bars[i].Low)
	}
	volRatio := 0.0
	volMean := 0.0
	for j := i - 19; j <= i; j++ {
		volMean += bars[j].Volume
	}
	volMean /= 20
	if volMean > 0 {
		volRatio = bars[i].Volume/volMean - 1
	}
	rsi := bars[i].RSI14 / 100
	return []float64{ret1, ret3, ret5, ma20Gap, ma60Gap, rangePct, closePos, volRatio, rsi}
}

func nearestRows(rows []featureRow, latest []float64, k int) []featureRow {
	type scored struct {
		row   featureRow
		score float64
	}
	scoredRows := make([]scored, 0, len(rows))
	means, stds := featureScale(rows)
	for _, row := range rows {
		score := 0.0
		for i := range latest {
			std := stds[i]
			if std == 0 {
				std = 1
			}
			d := (row.x[i] - latest[i]) / std
			score += d * d
		}
		scoredRows = append(scoredRows, scored{row: row, score: math.Sqrt(score) + means[0]*0})
	}
	sort.Slice(scoredRows, func(i, j int) bool { return scoredRows[i].score < scoredRows[j].score })
	if k > len(scoredRows) {
		k = len(scoredRows)
	}
	out := make([]featureRow, k)
	for i := 0; i < k; i++ {
		out[i] = scoredRows[i].row
	}
	return out
}

func walkForwardForecast(rows []featureRow) (int, float64, float64) {
	if len(rows) < 160 {
		return 0, 0, 0
	}
	start := len(rows) - 180
	if start < 80 {
		start = 80
	}
	errors := make([]float64, 0)
	correct := 0
	count := 0
	for i := start; i < len(rows); i++ {
		train := rows[:i]
		k := 60
		if len(train) < k {
			k = len(train)
		}
		neighbors := nearestRows(train, rows[i].x, k)
		preds := make([]float64, len(neighbors))
		for j, row := range neighbors {
			preds[j] = row.ret
		}
		pred := average(preds)
		actual := rows[i].ret
		errors = append(errors, math.Abs(pred-actual))
		if (pred >= 0 && actual >= 0) || (pred < 0 && actual < 0) {
			correct++
		}
		count++
	}
	if count == 0 {
		return 0, 0, 0
	}
	return count, average(errors), float64(correct) / float64(count)
}

func featureScale(rows []featureRow) ([]float64, []float64) {
	if len(rows) == 0 {
		return nil, nil
	}
	n := len(rows[0].x)
	means := make([]float64, n)
	stds := make([]float64, n)
	for _, row := range rows {
		for i, value := range row.x {
			means[i] += value
		}
	}
	for i := range means {
		means[i] /= float64(len(rows))
	}
	for _, row := range rows {
		for i, value := range row.x {
			d := value - means[i]
			stds[i] += d * d
		}
	}
	for i := range stds {
		stds[i] = math.Sqrt(stds[i] / math.Max(float64(len(rows)-1), 1))
	}
	return means, stds
}

func parseDate(value string) time.Time {
	t, err := time.Parse("2006-01-02", value)
	if err != nil {
		return time.Now()
	}
	return t
}

func nextTradingDate(start time.Time, offset int) time.Time {
	t := start
	added := 0
	for added < offset {
		t = t.AddDate(0, 0, 1)
		if t.Weekday() == time.Saturday || t.Weekday() == time.Sunday {
			continue
		}
		added++
	}
	return t
}
