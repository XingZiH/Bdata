const state = {
  response: null,
  charts: {},
};

const $ = (id) => document.getElementById(id);

function pct(value, digits = 2) {
  if (!Number.isFinite(value)) return "--";
  return `${(value * 100).toFixed(digits)}%`;
}

function num(value, digits = 2) {
  if (!Number.isFinite(value)) return "--";
  return value.toFixed(digits);
}

function money(value) {
  if (!Number.isFinite(value)) return "--";
  return value.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
}

function status(text, isError = false) {
  $("statusText").textContent = text;
  $("statusText").style.color = isError ? "#c2413a" : "#687386";
}

async function fetchJSON(url, options) {
  const res = await fetch(url, options);
  const payload = await res.json();
  if (!res.ok || payload.error) {
    throw new Error(payload.error || `HTTP ${res.status}`);
  }
  return payload;
}

async function loadStocks(query = "") {
  const payload = await fetchJSON(`/api/stocks?q=${encodeURIComponent(query)}&limit=300`);
  const list = $("stockList");
  list.innerHTML = "";
  payload.items.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.code;
    option.label = `${item.code} ${item.name} ${item.exchange}`;
    list.appendChild(option);
  });
}

function requestFromForm() {
  return {
    code: $("codeInput").value.trim(),
    start: $("startInput").value,
    end: $("endInput").value,
    fastMA: Number($("fastInput").value),
    slowMA: Number($("slowInput").value),
    initialCash: Number($("cashInput").value),
    feeRate: Number($("feeInput").value),
    slippageRate: Number($("slippageInput").value),
    forecastDays: Number($("horizonInput").value),
  };
}

async function runBacktest() {
  const req = requestFromForm();
  if (!req.code) {
    status("请输入股票代码", true);
    return;
  }
  $("runBtn").disabled = true;
  status(`正在拉取 ${req.code} 行情并运行训练回测...`);
  try {
    const payload = await fetchJSON("/api/backtest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    state.response = payload;
    renderAll(payload);
    status(`完成：${payload.bars.length} 根K线，${payload.trades.length} 笔历史交易，${payload.forecast.sampleCount || 0} 条相似样本`);
  } catch (err) {
    console.error(err);
    status(err.message, true);
  } finally {
    $("runBtn").disabled = false;
  }
}

function renderAll(payload) {
  $("pageTitle").textContent = `${payload.request.code} · 在线回测与三日预测`;
  renderAdvice(payload.advice || {});
  renderMetrics(payload.metrics || {}, payload.forecast || {});
  renderKChart(payload);
  renderActionChart(payload);
  renderIndicatorChart(payload);
  renderEquityChart(payload);
  renderForecastChart(payload.forecast || {}, payload.bars || []);
  renderRiskChart(payload.advice || {});
  renderTrades(payload.trades || []);
}

function renderAdvice(advice) {
  $("actionLabel").textContent = advice.actionLabel || "--";
  $("positionHint").textContent = advice.positionHint || "暂无建议";
  $("confidenceValue").textContent = Number.isFinite(advice.confidence) ? `${advice.confidence}/100` : "--";
  $("scoreBreakdown").textContent = `趋势 ${advice.trendScore || 0} / 风险 ${advice.riskScore || 0} / 预测 ${advice.forecastScore || 0}`;
  $("suggestedShares").textContent = advice.suggestedShares > 0 ? `${advice.suggestedShares} 股` : "不下单";
  $("estimatedCost").textContent = advice.estimatedCost > 0 ? `预计占用 ${money(advice.estimatedCost)} 元` : "等待确认";
  $("lastCloseValue").textContent = price(advice.lastClose);
  $("buyZoneValue").textContent = advice.buyLow && advice.buyHigh ? `${price(advice.buyLow)} - ${price(advice.buyHigh)}` : "--";
  $("confirmValue").textContent = price(advice.confirmLine);
  $("noChaseValue").textContent = price(advice.noChaseLine);
  $("stopValue").textContent = price(advice.stopLoss);
  $("hardStopValue").textContent = price(advice.hardStop);
  $("takeProfitValue").textContent = advice.takeProfit1 && advice.takeProfit2 ? `${price(advice.takeProfit1)} / ${price(advice.takeProfit2)}` : "--";
  $("rrValue").textContent = advice.riskReward ? `${num(advice.riskReward, 2)} : 1` : "--";
  renderList("entryPlanList", advice.entryPlan || []);
  renderList("reasonList", advice.reasons || []);
  renderList("warningList", advice.warnings || []);
}

function renderList(id, items) {
  const node = $(id);
  node.innerHTML = "";
  const rows = items.length ? items : ["暂无"];
  rows.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    node.appendChild(li);
  });
}

function renderMetrics(metrics, forecast) {
  const rows = [
    ["总收益", pct(metrics.totalReturn)],
    ["年化收益", pct(metrics.annualizedReturn)],
    ["最大回撤", pct(metrics.maxDrawdown)],
    ["夏普比率", num(metrics.sharpe, 2)],
    ["胜率", pct(metrics.winRate)],
    ["盈亏因子", num(metrics.profitFactor, 2)],
    ["交易次数", String(metrics.tradeCount || 0)],
    ["预测上涨", pct(forecast.probPositive)],
  ];
  const grid = $("metricsGrid");
  grid.innerHTML = "";
  rows.forEach(([label, value]) => {
    const article = document.createElement("article");
    const cls = classifyMetric(label, value);
    article.innerHTML = `<span>${label}</span><strong class="${cls}">${value}</strong>`;
    grid.appendChild(article);
  });
}

function classifyMetric(label, value) {
  const parsed = parseFloat(String(value).replace("%", ""));
  if (!Number.isFinite(parsed)) return "";
  if (label.includes("回撤")) return "risk-text";
  if (label.includes("总收益") || label.includes("年化") || label.includes("预测")) {
    return parsed >= 0 ? "positive" : "negative";
  }
  return "";
}

function chart(id) {
  if (!state.charts[id]) {
    state.charts[id] = echarts.init($(id), null, { renderer: "canvas" });
  }
  return state.charts[id];
}

function price(value) {
  if (!Number.isFinite(value) || value <= 0) return "--";
  return num(value, 2);
}

function recentBars(bars, count = 130) {
  if (!Array.isArray(bars)) return [];
  return bars.slice(Math.max(0, bars.length - count));
}

function levelLines(advice) {
  if (!advice) return [];
  const lines = [
    ["买入上沿", advice.buyHigh, "#23835c"],
    ["买入下沿", advice.buyLow, "#23835c"],
    ["确认线", advice.confirmLine, "#236a8a"],
    ["不追线", advice.noChaseLine, "#a47d1a"],
    ["止损线", advice.stopLoss, "#c2413a"],
    ["硬止损", advice.hardStop, "#7f1d1d"],
    ["止盈1", advice.takeProfit1, "#d97706"],
    ["止盈2", advice.takeProfit2, "#b45309"],
  ];
  return lines
    .filter(([, value]) => Number.isFinite(value) && value > 0)
    .map(([name, value, color]) => ({
      name,
      yAxis: value,
      lineStyle: { color, type: name.includes("止损") ? "dashed" : "solid", width: 1.4 },
      label: { formatter: `${name} ${price(value)}`, color },
    }));
}

function renderKChart(payload) {
  const bars = payload.bars || [];
  const advice = payload.advice || {};
  const dates = bars.map((bar) => bar.date);
  const candles = bars.map((bar) => [bar.open, bar.close, bar.low, bar.high]);
  const buyMarks = (payload.trades || []).map((trade) => ({
    name: "买入",
    coord: [trade.entryDate, trade.entryPrice],
    value: "买",
    itemStyle: { color: "#c2413a" },
  }));
  const sellMarks = (payload.trades || []).map((trade) => ({
    name: "卖出",
    coord: [trade.exitDate, trade.exitPrice],
    value: "卖",
    itemStyle: { color: "#23835c" },
  }));
  chart("kChart").setOption({
    animation: false,
    grid: [
      { left: 56, right: 24, top: 40, height: "60%" },
      { left: 56, right: 24, top: "75%", height: "15%" },
    ],
    tooltip: { trigger: "axis", axisPointer: { type: "cross" } },
    legend: { top: 6, data: ["K线", "快线", "慢线", "布林上轨", "布林下轨", "成交量"] },
    xAxis: [
      { type: "category", data: dates, boundaryGap: true, axisLine: { lineStyle: { color: "#dfe5ee" } } },
      { type: "category", data: dates, gridIndex: 1, axisLabel: { show: false } },
    ],
    yAxis: [
      { scale: true, splitLine: { lineStyle: { color: "#e9eef5" } } },
      { scale: true, gridIndex: 1, splitLine: { show: false }, axisLabel: { formatter: (v) => `${v.toFixed(0)}万` } },
    ],
    dataZoom: [
      { type: "inside", xAxisIndex: [0, 1], start: 55, end: 100 },
      { xAxisIndex: [0, 1], start: 55, end: 100 },
    ],
    series: [
      {
        name: "K线",
        type: "candlestick",
        data: candles,
        itemStyle: { color: "#c2413a", color0: "#23835c", borderColor: "#c2413a", borderColor0: "#23835c" },
        markPoint: { symbolSize: 30, data: [...buyMarks, ...sellMarks] },
        markLine: { symbol: "none", data: levelLines(advice), silent: true },
        markArea: buyMarkArea(advice),
      },
      { name: "快线", type: "line", data: bars.map((bar) => bar.fastMA || null), smooth: true, showSymbol: false, lineStyle: { color: "#236a8a" } },
      { name: "慢线", type: "line", data: bars.map((bar) => bar.slowMA || null), smooth: true, showSymbol: false, lineStyle: { color: "#a47d1a" } },
      { name: "布林上轨", type: "line", data: bars.map((bar) => bar.bollUpper || null), showSymbol: false, lineStyle: { color: "#8b5cf6", type: "dashed", width: 1 } },
      { name: "布林下轨", type: "line", data: bars.map((bar) => bar.bollLower || null), showSymbol: false, lineStyle: { color: "#8b5cf6", type: "dashed", width: 1 } },
      { name: "成交量", type: "bar", xAxisIndex: 1, yAxisIndex: 1, data: bars.map((bar) => bar.volume / 10000), itemStyle: { color: "#b8c7d9" } },
    ],
  });
}

function buyMarkArea(advice) {
  if (!advice.buyLow || !advice.buyHigh) return undefined;
  return {
    silent: true,
    itemStyle: { color: "rgba(35,131,92,.12)" },
    data: [[{ name: "买入区", yAxis: advice.buyLow }, { yAxis: advice.buyHigh }]],
  };
}

function renderActionChart(payload) {
  const bars = recentBars(payload.bars || [], 100);
  const advice = payload.advice || {};
  const dates = bars.map((bar) => bar.date);
  const line = (value) => dates.map(() => (Number.isFinite(value) && value > 0 ? value : null));
  chart("actionChart").setOption({
    animation: false,
    tooltip: { trigger: "axis" },
    legend: { top: 5, data: ["收盘价", "买入上沿", "买入下沿", "确认线", "止损线", "止盈1"] },
    grid: { left: 52, right: 24, top: 42, bottom: 38 },
    xAxis: { type: "category", data: dates },
    yAxis: { type: "value", scale: true, splitLine: { lineStyle: { color: "#e9eef5" } } },
    series: [
      { name: "收盘价", type: "line", data: bars.map((bar) => bar.close), showSymbol: false, lineStyle: { color: "#17202c", width: 2 } },
      { name: "买入上沿", type: "line", data: line(advice.buyHigh), showSymbol: false, lineStyle: { color: "#23835c" } },
      { name: "买入下沿", type: "line", data: line(advice.buyLow), showSymbol: false, lineStyle: { color: "#23835c", type: "dashed" }, areaStyle: { color: "rgba(35,131,92,.08)" } },
      { name: "确认线", type: "line", data: line(advice.confirmLine), showSymbol: false, lineStyle: { color: "#236a8a" } },
      { name: "止损线", type: "line", data: line(advice.stopLoss), showSymbol: false, lineStyle: { color: "#c2413a", type: "dashed" } },
      { name: "止盈1", type: "line", data: line(advice.takeProfit1), showSymbol: false, lineStyle: { color: "#d97706" } },
    ],
  });
}

function renderIndicatorChart(payload) {
  const bars = recentBars(payload.bars || [], 140);
  const dates = bars.map((bar) => bar.date);
  chart("indicatorChart").setOption({
    animation: false,
    tooltip: { trigger: "axis" },
    legend: { top: 5, data: ["RSI14", "MACD柱", "DIF", "DEA"] },
    grid: [
      { left: 52, right: 24, top: 42, height: "34%" },
      { left: 52, right: 24, top: "61%", height: "25%" },
    ],
    xAxis: [
      { type: "category", data: dates, axisLabel: { show: false } },
      { type: "category", data: dates, gridIndex: 1 },
    ],
    yAxis: [
      { type: "value", min: 0, max: 100, splitLine: { lineStyle: { color: "#e9eef5" } } },
      { type: "value", gridIndex: 1, scale: true, splitLine: { lineStyle: { color: "#e9eef5" } } },
    ],
    series: [
      {
        name: "RSI14",
        type: "line",
        data: bars.map((bar) => bar.rsi14 || null),
        showSymbol: false,
        lineStyle: { color: "#236a8a", width: 2 },
        markLine: {
          symbol: "none",
          data: [
            { yAxis: 70, name: "过热", lineStyle: { color: "#c2413a", type: "dashed" } },
            { yAxis: 50, name: "中轴", lineStyle: { color: "#687386", type: "dashed" } },
            { yAxis: 30, name: "超卖", lineStyle: { color: "#23835c", type: "dashed" } },
          ],
        },
      },
      {
        name: "MACD柱",
        type: "bar",
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: bars.map((bar) => bar.macdHist || 0),
        itemStyle: { color: (params) => (params.value >= 0 ? "#c2413a" : "#23835c") },
      },
      { name: "DIF", type: "line", xAxisIndex: 1, yAxisIndex: 1, data: bars.map((bar) => bar.macd || 0), showSymbol: false, lineStyle: { color: "#236a8a" } },
      { name: "DEA", type: "line", xAxisIndex: 1, yAxisIndex: 1, data: bars.map((bar) => bar.macdSignal || 0), showSymbol: false, lineStyle: { color: "#a47d1a" } },
    ],
  });
}

function renderEquityChart(payload) {
  const bars = payload.bars || [];
  chart("equityChart").setOption({
    animation: false,
    tooltip: { trigger: "axis" },
    legend: { top: 5, data: ["策略净值", "最大回撤"] },
    grid: { left: 56, right: 24, top: 42, bottom: 38 },
    xAxis: { type: "category", data: bars.map((bar) => bar.date) },
    yAxis: [
      { type: "value", scale: true },
      { type: "value", axisLabel: { formatter: (v) => `${(v * 100).toFixed(0)}%` } },
    ],
    dataZoom: [{ type: "inside", start: 55, end: 100 }],
    series: [
      { name: "策略净值", type: "line", data: bars.map((bar) => bar.equity), showSymbol: false, lineStyle: { color: "#236a8a", width: 2 } },
      { name: "最大回撤", type: "line", yAxisIndex: 1, data: bars.map((bar) => bar.drawdown), showSymbol: false, areaStyle: { color: "rgba(194,65,58,.12)" }, lineStyle: { color: "#c2413a" } },
    ],
  });
}

function renderForecastChart(forecast, bars) {
  if (!bars.length) return;
  const last = bars[bars.length - 1];
  const points = forecast.points || [];
  const dates = [last.date, ...points.map((p) => p.date)];
  const mean = [last.close, ...points.map((p) => p.meanClose)];
  chart("forecastChart").setOption({
    animation: false,
    tooltip: { trigger: "axis" },
    legend: { top: 5, data: ["预测均值", "P20", "P80", "P10", "P90"] },
    grid: { left: 52, right: 24, top: 42, bottom: 38 },
    xAxis: { type: "category", data: dates },
    yAxis: { type: "value", scale: true, splitLine: { lineStyle: { color: "#e9eef5" } } },
    series: [
      { name: "预测均值", type: "line", data: mean, lineStyle: { color: "#236a8a", width: 3 } },
      { name: "P20", type: "line", data: [last.close, ...points.map((p) => p.p20)], lineStyle: { color: "#687386", type: "dashed" }, showSymbol: false },
      { name: "P80", type: "line", data: [last.close, ...points.map((p) => p.p80)], lineStyle: { color: "#687386", type: "dashed" }, showSymbol: false, areaStyle: { color: "rgba(35,106,138,.10)" } },
      { name: "P10", type: "line", data: [last.close, ...points.map((p) => p.p10)], lineStyle: { color: "#cbd5e1", type: "dotted" }, showSymbol: false },
      { name: "P90", type: "line", data: [last.close, ...points.map((p) => p.p90)], lineStyle: { color: "#cbd5e1", type: "dotted" }, showSymbol: false },
    ],
  });
}

function renderRiskChart(advice) {
  const buy = advice.buyHigh;
  const rows = [
    ["硬止损", advice.hardStop],
    ["止损线", advice.stopLoss],
    ["买入上沿", advice.buyHigh],
    ["止盈1", advice.takeProfit1],
    ["止盈2", advice.takeProfit2],
  ];
  const data = rows.map(([, value]) => (Number.isFinite(buy) && Number.isFinite(value) ? Number((value - buy).toFixed(2)) : 0));
  chart("riskChart").setOption({
    animation: false,
    tooltip: { trigger: "axis", valueFormatter: (v) => `${v} 元/股` },
    grid: { left: 54, right: 18, top: 28, bottom: 40 },
    xAxis: { type: "category", data: rows.map(([name]) => name) },
    yAxis: { type: "value", axisLabel: { formatter: (v) => `${v}` }, splitLine: { lineStyle: { color: "#e9eef5" } } },
    series: [
      {
        name: "单股盈亏",
        type: "bar",
        data,
        itemStyle: { color: (params) => (params.value >= 0 ? "#c2413a" : "#23835c") },
        label: { show: true, position: "top", formatter: "{c}" },
      },
    ],
  });
}

function renderTrades(trades) {
  $("tradeSummary").textContent = `${trades.length} 笔`;
  const body = $("tradesBody");
  body.innerHTML = "";
  if (!trades.length) {
    body.innerHTML = `<tr><td colspan="8">暂无交易</td></tr>`;
    return;
  }
  trades.slice().reverse().forEach((trade) => {
    const tr = document.createElement("tr");
    const cls = trade.pnl >= 0 ? "positive" : "negative";
    tr.innerHTML = `
      <td>${trade.entryDate}</td>
      <td>${trade.exitDate}</td>
      <td>${num(trade.entryPrice)}</td>
      <td>${num(trade.exitPrice)}</td>
      <td class="${cls}">${pct(trade.return)}</td>
      <td class="${cls}">${money(trade.pnl)}</td>
      <td>${trade.barsHeld}</td>
      <td>${trade.reason}</td>
    `;
    body.appendChild(tr);
  });
}

function setSample(code, start = "2024-01-01", cash = "1500") {
  $("codeInput").value = code;
  $("startInput").value = start;
  $("cashInput").value = cash;
  runBacktest();
}

window.addEventListener("resize", () => {
  Object.values(state.charts).forEach((c) => c.resize());
});

$("runBtn").addEventListener("click", runBacktest);
$("searchBtn").addEventListener("click", () => loadStocks($("codeInput").value.trim()).catch((err) => status(err.message, true)));
$("sampleHuatian").addEventListener("click", () => setSample("002185", "2024-01-01", "1500"));
$("sampleTaiji").addEventListener("click", () => setSample("600129", "2024-01-01", "3000"));
$("samplePingan").addEventListener("click", () => setSample("000001", "2023-01-01", "1500"));

loadStocks().catch((err) => console.warn(err));
runBacktest();
