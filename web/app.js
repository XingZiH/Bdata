const state = {
  response: null,
  charts: {},
  stocks: [],
  filteredStocks: [],
  currentPage: "stock",
  selectedSector: "",
  watchlist: loadSavedWatchlist(),
  watchSnapshots: {},
  monitorTimer: null,
  monitorRunning: false,
  aiConfig: null,
  quotes: {},
  recommendations: [],
};

const $ = (id) => document.getElementById(id);

function loadSavedWatchlist() {
  try {
    const rows = JSON.parse(localStorage.getItem("adata-watchlist") || "[]");
    if (!Array.isArray(rows)) return [];
    return rows
      .filter((item) => item && String(item.code || "").trim())
      .slice(0, 20)
      .map((item) => ({
        code: String(item.code).trim(),
        name: String(item.name || "").trim(),
      }));
  } catch {
    return [];
  }
}

function saveWatchlist() {
  localStorage.setItem("adata-watchlist", JSON.stringify(state.watchlist.slice(0, 20)));
}

const sectorThemes = [
  {
    id: "robotics",
    type: "hot",
    name: "机器人 / 具身智能",
    heat: 96,
    risk: "高波动",
    catalyst: "7月3日机器人板块持续上攻，宇树链、T链和优必选概念活跃。",
    source: "东方财富热门股追踪",
    sourceUrl: "https://stock.eastmoney.com/a/cggdj.html",
    companies: [
      ["002747", "埃斯顿", "机器人涨停潮核心标的"],
      ["002979", "雷赛智能", "运动控制和机器人链"],
      ["002472", "双环传动", "减速器和机器人执行端"],
      ["688017", "绿的谐波", "谐波减速器"],
      ["300124", "汇川技术", "工业自动化"],
      ["002896", "中大力德", "减速器和驱动系统"],
      ["603728", "鸣志电器", "控制电机"],
      ["002031", "巨轮智能", "机器人概念"],
    ],
  },
  {
    id: "ai-compute",
    type: "hot",
    name: "AI 算力 / 半导体",
    heat: 92,
    risk: "拥挤度高",
    catalyst: "7月策略仍看好国产算力；半导体、光模块、AI算力链是市场核心主线，但短线波动加大。",
    source: "证券时报7月策略 / 新浪财经",
    sourceUrl: "https://www.stcn.com/article/detail/3993850.html",
    companies: [
      ["300308", "中际旭创", "光模块"],
      ["300502", "新易盛", "高速光模块"],
      ["300394", "天孚通信", "光通信器件"],
      ["002281", "光迅科技", "光通信"],
      ["002371", "北方华创", "半导体设备"],
      ["688012", "中微公司", "半导体设备"],
      ["300223", "北京君正", "存储芯片涨价线索"],
      ["603986", "兆易创新", "存储与MCU"],
      ["688981", "中芯国际", "晶圆制造"],
      ["300604", "长川科技", "测试设备"],
    ],
  },
  {
    id: "aerospace-defense",
    type: "hot",
    name: "军工 / 商业航天",
    heat: 88,
    risk: "事件驱动",
    catalyst: "商业航天、军用无人机、导弹和地面无人装备等方向被机构看好。",
    source: "证券时报",
    sourceUrl: "https://www.stcn.com/article/detail/3997487.html",
    companies: [
      ["000547", "航天发展", "商业航天和军工信息化"],
      ["600118", "中国卫星", "卫星制造"],
      ["600760", "中航沈飞", "航空装备"],
      ["000768", "中航西飞", "航空装备"],
      ["300034", "钢研高纳", "高温合金"],
      ["300775", "三角防务", "航空锻件"],
      ["002025", "航天电器", "军工连接器"],
      ["688297", "中无人机", "无人机装备"],
      ["300474", "景嘉微", "军工芯片"],
    ],
  },
  {
    id: "metals-gold",
    type: "hot",
    name: "有色金属 / 黄金",
    heat: 84,
    risk: "跟随商品",
    catalyst: "7月策略关注资源安全与能源体系重构；黄金股受海外就业和利率预期扰动活跃。",
    source: "证券时报 / 新浪港股",
    sourceUrl: "https://www.xincai.com/article/nifpkay3629866",
    companies: [
      ["601899", "紫金矿业", "铜金资源龙头"],
      ["600547", "山东黄金", "黄金"],
      ["600489", "中金黄金", "黄金"],
      ["600988", "赤峰黄金", "黄金弹性"],
      ["000630", "铜陵有色", "铜"],
      ["000807", "云铝股份", "铝"],
      ["002466", "天齐锂业", "锂资源"],
      ["002460", "赣锋锂业", "锂资源"],
      ["603799", "华友钴业", "钴镍材料"],
    ],
  },
  {
    id: "innovative-drug",
    type: "hot",
    name: "创新药 / 医药反弹",
    heat: 80,
    risk: "分化明显",
    catalyst: "医药股近期反弹，创新药商业化和出海逻辑继续被资金关注。",
    source: "东方财富股票频道 / 新浪港股",
    sourceUrl: "https://stock.eastmoney.com/",
    companies: [
      ["688235", "百济神州", "创新药龙头"],
      ["688331", "荣昌生物", "创新药反弹"],
      ["600276", "恒瑞医药", "创新药"],
      ["603259", "药明康德", "CXO"],
      ["300759", "康龙化成", "CXO"],
      ["300347", "泰格医药", "临床CRO"],
      ["688180", "君实生物", "创新药"],
      ["688266", "泽璟制药", "创新药"],
    ],
  },
  {
    id: "dividend",
    type: "hot",
    name: "高股息 / 红利防守",
    heat: 76,
    risk: "进攻性弱",
    catalyst: "成长拥挤度较高时，高股息板块具备防御底仓价值。",
    source: "新浪财经",
    sourceUrl: "https://www.xincai.com/article/nifkyvw5888105",
    companies: [
      ["601398", "工商银行", "银行红利"],
      ["601288", "农业银行", "银行红利"],
      ["601988", "中国银行", "银行红利"],
      ["600900", "长江电力", "电力红利"],
      ["601088", "中国神华", "煤炭红利"],
      ["600028", "中国石化", "能源红利"],
      ["601006", "大秦铁路", "交运红利"],
      ["600886", "国投电力", "电力红利"],
      ["600019", "宝钢股份", "钢铁红利"],
    ],
  },
  {
    id: "glass-substrate",
    type: "news",
    name: "玻璃基板 / 先进封装",
    heat: 74,
    risk: "题材兑现",
    catalyst: "同花顺概念板块显示玻璃基板有近期驱动事件，先进封装链条延续关注。",
    source: "同花顺概念板块",
    sourceUrl: "https://q.10jqka.com.cn/gn/",
    companies: [
      ["000725", "京东方A", "显示面板"],
      ["000050", "深天马A", "显示面板"],
      ["002384", "东山精密", "PCB/消费电子"],
      ["600183", "生益科技", "覆铜板"],
      ["600703", "三安光电", "化合物半导体"],
      ["002456", "欧菲光", "消费电子"],
      ["300433", "蓝思科技", "消费电子玻璃"],
    ],
  },
  {
    id: "solid-battery",
    type: "news",
    name: "固态电池 / 新能源",
    heat: 72,
    risk: "产业验证",
    catalyst: "固态电池持续火热，新能源车政策和材料链事件带来交易线索。",
    source: "证券时报电池新国标",
    sourceUrl: "https://www.stcn.com/article/detail/3994407.html",
    companies: [
      ["300750", "宁德时代", "动力电池"],
      ["002594", "比亚迪", "新能源车"],
      ["002074", "国轩高科", "动力电池"],
      ["300014", "亿纬锂能", "锂电池"],
      ["002709", "天赐材料", "电解液"],
      ["300073", "当升科技", "正极材料"],
      ["002460", "赣锋锂业", "固态电池/锂"],
      ["002466", "天齐锂业", "锂资源"],
    ],
  },
  {
    id: "earnings-preview",
    type: "news",
    name: "中报预增 / 业绩验证",
    heat: 70,
    risk: "财报落地",
    catalyst: "7月进入中报季，市场从景气预期转向景气确认，业绩能验证的方向更容易留住资金。",
    source: "证券时报",
    sourceUrl: "https://www.stcn.com/article/detail/3993850.html",
    companies: [
      ["300223", "北京君正", "存储涨价与盈利弹性"],
      ["300308", "中际旭创", "AI算力业绩验证"],
      ["300502", "新易盛", "AI算力业绩验证"],
      ["002384", "东山精密", "消费电子/PCB"],
      ["002472", "双环传动", "机器人链"],
      ["601899", "紫金矿业", "资源品"],
    ],
  },
];

const monthMarketNotes = [
  "7月3日A股反弹，机器人概念爆发，军工、汽车、医药、黄金等方向活跃；半导体板块短线调整。",
  "7月进入中报预告窗口，资金从单纯景气预期转向业绩兑现验证。",
  "7月策略继续关注国产算力、AI硬件和有色金属，但科技线拥挤度较高，需要控制追高。",
  "贵金属、减速器、机器人、电机、国防军工等方向近期涨幅居前，强势板块也需要观察量价承接。",
];

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

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function colors() {
  return {
    text: cssVar("--ink"),
    muted: cssVar("--muted"),
    grid: cssVar("--grid"),
    axis: cssVar("--line"),
    blue: cssVar("--blue"),
    green: cssVar("--green"),
    red: cssVar("--red"),
    gold: cssVar("--gold"),
    violet: cssVar("--violet"),
  };
}

function status(text, isError = false) {
  $("statusText").textContent = text;
  $("statusText").style.color = isError ? cssVar("--red") : cssVar("--muted");
}

function currentTheme() {
  return document.documentElement.dataset.theme || "light";
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("adata-theme", theme);
  $("themeToggle").textContent = theme === "dark" ? "浅色模式" : "暗黑模式";
  Object.values(state.charts).forEach((instance) => instance.dispose());
  state.charts = {};
  if (state.response && !$("analysisPage").hidden) {
    renderAll(state.response);
  }
}

function initTheme() {
  const requested = new URLSearchParams(window.location.search).get("theme");
  const saved = localStorage.getItem("adata-theme");
  const preferred = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  setTheme(requested === "dark" || requested === "light" ? requested : saved || preferred);
}

async function fetchJSON(url, options) {
  const res = await fetch(url, options);
  const payload = await res.json();
  if (!res.ok || payload.error) {
    throw new Error(payload.error || `HTTP ${res.status}`);
  }
  return payload;
}

async function loadAIConfig() {
  try {
    const cfg = await fetchJSON("/api/ai/config");
    state.aiConfig = cfg;
    $("aiMonitorStatus").textContent = cfg.apiKeyConfigured
      ? `${cfg.model} · ${cfg.baseURL}`
      : `${cfg.model} · 等待 LOCAL_OP_API_KEY`;
  } catch (err) {
    $("aiMonitorStatus").textContent = `AI 配置失败：${err.message}`;
  }
}

async function loadStocks(query = "", limit = 5000) {
  status("正在加载在线股票列表...");
  const payload = await fetchJSON(`/api/stocks?q=${encodeURIComponent(query)}&limit=${limit}`);
  const items = payload.items || [];
  state.stocks = items;
  fillDatalist(items);
  fillSectorFilter();
  applyStockFilter();
  renderSectorCards();
  applyDiscoveryFilters(false);
  refreshCandidateQuotes(8, 4).catch((err) => {
    $("recommendationSummary").textContent = `价格刷新失败：${err.message}`;
  });
  if (!state.selectedSector && sectorThemes.length) {
    selectSector(sectorThemes[0].id);
  } else if (state.selectedSector) {
    renderSectorCompanies(sectorThemes.find((theme) => theme.id === state.selectedSector));
  }
  status(`股票列表已加载：${items.length} 只，可搜索后选择分析`);
}

function fillDatalist(items) {
  const list = $("stockList");
  list.innerHTML = "";
  items.slice(0, 1200).forEach((item) => {
    const option = document.createElement("option");
    option.value = item.code;
    option.label = `${item.code} ${item.name} ${item.exchange}`;
    list.appendChild(option);
  });
}

function fillSectorFilter() {
  const select = $("sectorFilterSelect");
  const current = select.value;
  select.innerHTML = `<option value="">全部板块</option>`;
  sectorThemes.forEach((theme) => {
    const option = document.createElement("option");
    option.value = theme.id;
    option.textContent = theme.name;
    select.appendChild(option);
  });
  if (current && sectorThemes.some((theme) => theme.id === current)) {
    select.value = current;
  }
}

function quoteFor(code) {
  return state.quotes[code] || null;
}

function quoteText(code) {
  const quote = quoteFor(code);
  if (!quote || !Number.isFinite(quote.price) || quote.price <= 0) return "--";
  const change = Number.isFinite(quote.changePct) ? ` ${quote.changePct >= 0 ? "+" : ""}${quote.changePct.toFixed(2)}%` : "";
  return `${price(quote.price)}${change}`;
}

function applyStockFilter() {
  const q = $("stockSearchInput").value.trim().toLowerCase();
  state.filteredStocks = state.stocks.filter((item) => {
    const text = `${item.code} ${item.name} ${item.exchange}`.toLowerCase();
    return q === "" || text.includes(q);
  });
  renderStockTable(state.filteredStocks);
}

function renderStockTable(items) {
  const body = $("stockTableBody");
  const countText = items.length > 500 ? `显示前 500 / 共 ${items.length} 只` : `共 ${items.length} 只`;
  $("stockCount").textContent = countText;
  body.innerHTML = "";
  if (!items.length) {
    body.innerHTML = `<tr><td colspan="5">没有匹配的股票，换个代码或名称试试</td></tr>`;
    return;
  }
  items.slice(0, 500).forEach((item) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.code}</td>
      <td>${item.name || "--"}</td>
      <td>${item.exchange || "--"}</td>
      <td>${quoteText(item.code)}</td>
      <td><button class="stock-action" data-code="${item.code}" data-name="${item.name || ""}" type="button">分析</button></td>
    `;
    body.appendChild(tr);
  });
}

function renderSectorCards() {
  const filters = getDiscoveryFilters();
  const themes = sectorThemes.filter((theme) => themeMatchesFilters(theme, filters));
  renderThemeCards(
    "hotSectorGrid",
    themes.filter((theme) => theme.type === "hot")
  );
  renderThemeCards(
    "newsSectorGrid",
    themes.filter((theme) => theme.type === "news")
  );
}

function getDiscoveryFilters() {
  return {
    sectorId: $("sectorFilterSelect")?.value || "",
    minPrice: Number($("minPriceInput")?.value) || 0,
    maxPrice: Number($("maxPriceInput")?.value) || 0,
    risk: $("riskFilterSelect")?.value || "",
    minHeat: Number($("minHeatInput")?.value) || 0,
  };
}

function themeMatchesFilters(theme, filters) {
  if (filters.sectorId && theme.id !== filters.sectorId) return false;
  if (filters.minHeat && theme.heat < filters.minHeat) return false;
  if (filters.risk && !riskMatches(theme.risk, filters.risk)) return false;
  return true;
}

function riskMatches(risk, target) {
  const text = String(risk || "");
  const high = /高波动|拥挤|事件|兑现|跟随商品|产业验证|财报|分化/.test(text);
  const low = /防守|进攻性弱|稳健|红利/.test(text);
  if (target === "high") return high;
  if (target === "low") return low;
  if (target === "medium") return !high || /分化|产业验证|财报/.test(text);
  return true;
}

function renderThemeCards(targetId, themes) {
  const box = $(targetId);
  box.innerHTML = "";
  if (!themes.length) {
    box.innerHTML = `<div class="empty-card">没有匹配的板块</div>`;
    return;
  }
  themes.forEach((theme) => {
    const card = document.createElement("article");
    card.className = `sector-card ${theme.type === "news" ? "event-card" : ""} ${
      state.selectedSector === theme.id ? "active" : ""
    }`;
    card.innerHTML = `
      <h4>${theme.name}</h4>
      <p>${theme.catalyst}</p>
      <div class="sector-meta">
        <span class="tag hot">热度 ${theme.heat}</span>
        <span class="tag risk">${theme.risk}</span>
      </div>
      <div class="sector-actions">
        <a class="source-link" href="${theme.sourceUrl}" target="_blank" rel="noopener">来源：${theme.source}</a>
        <button class="sector-select" data-sector="${theme.id}" type="button">查看公司池</button>
      </div>
    `;
    box.appendChild(card);
  });
}

function selectSector(id) {
  const theme = sectorThemes.find((item) => item.id === id);
  if (!theme) return;
  state.selectedSector = id;
  if ($("sectorFilterSelect") && !$("sectorFilterSelect").value) {
    $("sectorFilterSelect").value = id;
  }
  renderSectorCards();
  renderSectorCompanies(theme);
  renderRecommendations();
  status(`已选择板块：${theme.name}，可从公司池直接进入回测`);
}

function renderSectorCompanies(theme) {
  const body = $("sectorCompanyBody");
  if (!theme) {
    $("sectorCompanyTitle").textContent = "板块公司池";
    $("sectorCompanyCount").textContent = "先选择板块";
    body.innerHTML = `<tr><td colspan="6">先选择一个热门板块或新闻事件</td></tr>`;
    return;
  }
  const filters = getDiscoveryFilters();
  const stockMap = new Map(state.stocks.map((item) => [item.code, item]));
  const rows = theme.companies.map(([code, fallbackName, reason]) => {
    const stock = stockMap.get(code);
    const quote = quoteFor(code);
    return {
      code,
      name: stock?.name || fallbackName,
      exchange: stock?.exchange || inferExchange(code),
      reason,
      quote,
    };
  }).filter((item) => priceMatches(item.quote?.price, filters));
  $("sectorCompanyTitle").textContent = `${theme.name} · 公司池`;
  $("sectorCompanyCount").textContent = `${rows.length} 家候选 · 热度 ${theme.heat} · ${theme.risk}`;
  body.innerHTML = "";
  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="6">当前价格和风险条件下暂无匹配股票</td></tr>`;
    return;
  }
  rows.forEach((item) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.code}</td>
      <td>${item.name}</td>
      <td>${item.exchange}</td>
      <td>${quoteText(item.code)}</td>
      <td>${item.reason}</td>
      <td><button class="stock-action" data-code="${item.code}" data-name="${item.name}" type="button">分析</button></td>
    `;
    body.appendChild(tr);
  });
}

function inferExchange(code) {
  if (code.startsWith("6")) return "SH";
  if (code.startsWith("8") || code.startsWith("9")) return "BJ";
  return "SZ";
}

function priceMatches(value, filters) {
  if (!Number.isFinite(value) || value <= 0) return true;
  if (filters.minPrice && value < filters.minPrice) return false;
  if (filters.maxPrice && value > filters.maxPrice) return false;
  return true;
}

function riskPenalty(risk) {
  const text = String(risk || "");
  if (/拥挤|高波动|题材兑现/.test(text)) return 12;
  if (/事件|产业验证|跟随商品|财报|分化/.test(text)) return 8;
  if (/进攻性弱|防守|红利/.test(text)) return 3;
  return 5;
}

function buildRecommendationRows() {
  const filters = getDiscoveryFilters();
  const stockMap = new Map(state.stocks.map((item) => [item.code, item]));
  const rows = [];
  const seen = new Set();
  sectorThemes
    .filter((theme) => themeMatchesFilters(theme, filters))
    .forEach((theme) => {
      theme.companies.forEach(([code, fallbackName, reason]) => {
        if (seen.has(code)) return;
        seen.add(code);
        const stock = stockMap.get(code);
        const quote = quoteFor(code);
        if (!priceMatches(quote?.price, filters)) return;
        const knownPriceBonus = quote?.price ? 8 : 0;
        const priceBonus = quote?.price && filters.maxPrice && quote.price <= filters.maxPrice ? 8 : 0;
        const momentumBonus = quote?.changePct >= 0 ? Math.min(8, quote.changePct) : Math.max(-8, quote?.changePct || 0);
        const score = Math.round(theme.heat + knownPriceBonus + priceBonus + momentumBonus - riskPenalty(theme.risk));
        rows.push({
          code,
          name: stock?.name || fallbackName,
          exchange: stock?.exchange || inferExchange(code),
          sector: theme.name,
          heat: theme.heat,
          risk: theme.risk,
          reason,
          catalyst: theme.catalyst,
          source: theme.source,
          quote,
          score,
        });
      });
    });
  return rows.sort((a, b) => b.score - a.score).slice(0, 20);
}

function applyDiscoveryFilters(shouldRefreshPrices = false) {
  renderSectorCards();
  const selected = sectorThemes.find((theme) => theme.id === state.selectedSector);
  if (selected && themeMatchesFilters(selected, getDiscoveryFilters())) {
    renderSectorCompanies(selected);
  } else {
    const first = sectorThemes.find((theme) => themeMatchesFilters(theme, getDiscoveryFilters()));
    state.selectedSector = first?.id || "";
    renderSectorCompanies(first);
  }
  renderRecommendations();
  if (shouldRefreshPrices) {
    refreshCandidateQuotes().catch((err) => {
      $("recommendationSummary").textContent = `价格刷新失败：${err.message}`;
    });
  }
}

function renderRecommendations() {
  const rows = buildRecommendationRows();
  state.recommendations = rows;
  const body = $("recommendationBody");
  body.innerHTML = "";
  $("recommendationSummary").textContent = rows.length ? `${rows.length} 只候选 · 按评分排序` : "暂无匹配";
  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="7">调整价格、板块或风险条件后再试</td></tr>`;
    return;
  }
  rows.slice(0, 12).forEach((item) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.code}</td>
      <td>${item.name}</td>
      <td>${item.sector}</td>
      <td>${quoteText(item.code)}</td>
      <td>${item.score}</td>
      <td>${item.reason}</td>
      <td><button class="stock-action" data-code="${item.code}" data-name="${item.name}" type="button">分析</button></td>
    `;
    body.appendChild(tr);
  });
}

async function fetchQuotes(codes) {
  const unique = [...new Set(codes.filter(Boolean))].slice(0, 40);
  if (!unique.length) return [];
  const payload = await fetchJSON(`/api/quotes?codes=${encodeURIComponent(unique.join(","))}`);
  const items = payload.items || [];
  items.forEach((item) => {
    if (item.code && !item.error) {
      state.quotes[item.code] = item;
    }
  });
  return items;
}

async function refreshCandidateQuotes(recommendationLimit = 10, sectorLimit = 8) {
  const codes = buildRecommendationRows()
    .map((item) => item.code)
    .slice(0, recommendationLimit);
  const selected = sectorThemes.find((theme) => theme.id === state.selectedSector);
  if (selected) {
    selected.companies.slice(0, sectorLimit).forEach(([code]) => codes.push(code));
  }
  $("recommendationSummary").textContent = "正在刷新候选价格...";
  await fetchQuotes(codes);
  renderSectorCompanies(sectorThemes.find((theme) => theme.id === state.selectedSector));
  renderRecommendations();
  applyStockFilter();
}

function showPage(page) {
  state.currentPage = page;
  const isStock = page === "stock";
  $("stockPage").hidden = !isStock;
  $("analysisPage").hidden = isStock;
  $("navStock").classList.toggle("active", isStock);
  $("navAnalysis").classList.toggle("active", !isStock);
  if (isStock) {
    $("pageTitle").textContent = "在线选股中心";
    if (state.stocks.length) {
      status(`股票列表已加载：${state.stocks.length} 只，可搜索后选择分析`);
    }
  } else if (!state.response) {
    const code = $("codeInput").value.trim();
    $("pageTitle").textContent = code ? `${code} · 回测工作台` : "回测工作台";
    status(code ? "等待运行回测" : "请先输入或选择股票代码");
  }
  setTimeout(() => Object.values(state.charts).forEach((c) => c.resize()), 30);
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
    showPage("stock");
    status("请先从选股中心选择股票，或手动输入股票代码", true);
    return;
  }
  showPage("analysis");
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

function selectStock(code, name) {
  $("codeInput").value = code;
  $("pageTitle").textContent = `${code}${name ? ` · ${name}` : ""}`;
  runBacktest();
}

function currentStockMeta() {
  const code = $("codeInput").value.trim();
  const stock = state.stocks.find((item) => item.code === code);
  return { code, name: stock?.name || "" };
}

function ensureWatchItem(code, name = "") {
  code = String(code || "").trim();
  if (!code) return;
  const existing = state.watchlist.find((item) => item.code === code);
  if (existing) {
    if (name && !existing.name) existing.name = name;
  } else {
    state.watchlist.unshift({ code, name });
    state.watchlist = state.watchlist.slice(0, 20);
  }
  saveWatchlist();
  renderWatchlist();
}

function removeWatchItem(code) {
  state.watchlist = state.watchlist.filter((item) => item.code !== code);
  delete state.watchSnapshots[code];
  saveWatchlist();
  renderWatchlist();
}

function renderWatchlist() {
  const body = $("watchBody");
  body.innerHTML = "";
  if (!state.watchlist.length) {
    body.innerHTML = `<tr><td colspan="7">暂无盯盘标的</td></tr>`;
    return;
  }
  state.watchlist.forEach((item) => {
    const snapshot = state.watchSnapshots[item.code] || {};
    const cls = snapshot.changePct >= 0 ? "positive" : "negative";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.code}</td>
      <td>${item.name || "--"}</td>
      <td>${snapshot.close ? price(snapshot.close) : "--"}</td>
      <td class="${Number.isFinite(snapshot.changePct) ? cls : ""}">${formatWatchChange(snapshot.changePct)}</td>
      <td>${snapshot.signal || snapshot.error || "等待刷新"}</td>
      <td>${snapshot.updatedAt || "--"}</td>
      <td><button class="stock-action" data-watch-remove="${item.code}" type="button">移除</button></td>
    `;
    body.appendChild(tr);
  });
}

function formatWatchChange(value) {
  if (!Number.isFinite(value)) return "--";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function monitorStartDate() {
  const year = new Date().getFullYear() - 1;
  return `${year}-01-01`;
}

async function refreshWatchlist() {
  if (!state.watchlist.length) {
    renderWatchlist();
    $("aiMonitorStatus").textContent = state.aiConfig ? `${state.aiConfig.model} · 无盯盘标的` : "无盯盘标的";
    return;
  }
  $("aiMonitorStatus").textContent = state.monitorRunning ? "盯盘刷新中..." : "手动刷新中...";
  const start = monitorStartDate();
  const results = await Promise.allSettled(
    state.watchlist.map(async (item) => {
      const payload = await fetchJSON(`/api/market?code=${encodeURIComponent(item.code)}&start=${start}`);
      const bars = payload.bars || [];
      if (!bars.length) throw new Error("无行情");
      state.watchSnapshots[item.code] = buildWatchSnapshot(item, bars);
    })
  );
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      const item = state.watchlist[index];
      state.watchSnapshots[item.code] = {
        error: result.reason?.message || "刷新失败",
        updatedAt: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
      };
    }
  });
  renderWatchlist();
  const failed = results.filter((item) => item.status === "rejected").length;
  const model = state.aiConfig?.model || "AI";
  $("aiMonitorStatus").textContent = failed ? `${model} · ${failed} 个标的刷新失败` : `${model} · ${state.watchlist.length} 个标的已刷新`;
}

function buildWatchSnapshot(item, bars) {
  const last = bars[bars.length - 1];
  const prev = bars.length > 1 ? bars[bars.length - 2] : null;
  let changePct = Number(last.changePct);
  if (!Number.isFinite(changePct) && prev?.close > 0) {
    changePct = (last.close / prev.close - 1) * 100;
  }
  const volumeRatio = prev?.volume > 0 ? last.volume / prev.volume - 1 : 0;
  return {
    code: item.code,
    name: item.name,
    date: last.date,
    close: last.close,
    high: last.high,
    low: last.low,
    volume: last.volume,
    changePct,
    signal: classifyWatchSignal(changePct, volumeRatio, last, prev),
    updatedAt: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
  };
}

function classifyWatchSignal(changePct, volumeRatio, last, prev) {
  if (!prev || !Number.isFinite(changePct)) return "数据不足";
  if (changePct >= 3 && volumeRatio > 0.2) return "放量强势";
  if (changePct >= 1.2) return "偏强观察";
  if (changePct <= -3 && volumeRatio > 0.2) return "放量转弱";
  if (changePct <= -1.2) return "回落防守";
  const range = last.close > 0 ? (last.high - last.low) / last.close : 0;
  if (range > 0.06) return "波动扩大";
  return "窄幅震荡";
}

function startMonitor() {
  if (state.monitorTimer) clearInterval(state.monitorTimer);
  const seconds = Math.min(300, Math.max(15, Number($("monitorIntervalInput").value) || 45));
  $("monitorIntervalInput").value = seconds;
  state.monitorRunning = true;
  refreshWatchlist().catch((err) => {
    $("aiMonitorStatus").textContent = err.message;
  });
  state.monitorTimer = setInterval(() => {
    refreshWatchlist().catch((err) => {
      $("aiMonitorStatus").textContent = err.message;
    });
  }, seconds * 1000);
}

function stopMonitor() {
  if (state.monitorTimer) clearInterval(state.monitorTimer);
  state.monitorTimer = null;
  state.monitorRunning = false;
  $("aiMonitorStatus").textContent = state.aiConfig ? `${state.aiConfig.model} · 已暂停` : "已暂停";
}

function buildAIContext() {
  const current = currentStockMeta();
  const sector = sectorThemes.find((theme) => theme.companies.some(([code]) => code === current.code));
  const payload = state.response || {};
  const recent = recentBars(payload.bars || [], 45).map((bar) => ({
    date: bar.date,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume,
    fastMA: bar.fastMA,
    slowMA: bar.slowMA,
    ma20: bar.ma20,
    ma60: bar.ma60,
    rsi14: bar.rsi14,
    macdHist: bar.macdHist,
    volumeRatio20: bar.volumeRatio20,
  }));
  return {
    generatedAt: new Date().toISOString(),
    current,
    sector: sector
      ? {
          name: sector.name,
          heat: sector.heat,
          risk: sector.risk,
          catalyst: sector.catalyst,
          source: sector.source,
        }
      : null,
    monitor: {
      running: state.monitorRunning,
      snapshots: state.watchlist.map((item) => state.watchSnapshots[item.code] || { code: item.code, name: item.name }),
    },
    backtest: {
      request: payload.request || requestFromForm(),
      metrics: payload.metrics || null,
      advice: payload.advice || null,
      forecast: payload.forecast || null,
      recentBars: recent,
    },
  };
}

async function runAIAnalysis() {
  const current = currentStockMeta();
  if (!current.code) {
    $("aiInsight").textContent = "请先选择股票";
    return;
  }
  ensureWatchItem(current.code, current.name);
  $("aiAnalyzeBtn").disabled = true;
  $("aiInsight").textContent = "AI 分析中...";
  try {
    if (!state.watchSnapshots[current.code]) {
      await refreshWatchlist();
    }
    const payload = await fetchJSON("/api/ai/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: current.code,
        name: current.name,
        mode: "watch",
        context: buildAIContext(),
      }),
    });
    $("aiInsight").textContent = payload.content || "AI 未返回内容";
    $("aiMonitorStatus").textContent = `${payload.model || state.aiConfig?.model || "AI"} · ${new Date(payload.createdAt || Date.now()).toLocaleTimeString("zh-CN", { hour12: false })}`;
  } catch (err) {
    $("aiInsight").textContent = `AI 分析失败：${err.message}`;
    $("aiMonitorStatus").textContent = "AI 调用失败";
  } finally {
    $("aiAnalyzeBtn").disabled = false;
  }
}

async function runAISectorScan() {
  $("aiSectorBtn").disabled = true;
  $("aiSectorStatus").textContent = "AI 研判中...";
  $("aiSectorInsight").textContent = "正在刷新价格并生成本月板块研判...";
  try {
    await refreshCandidateQuotes();
    const filters = getDiscoveryFilters();
    const themes = sectorThemes
      .filter((theme) => themeMatchesFilters(theme, filters))
      .map((theme) => ({
        name: theme.name,
        heat: theme.heat,
        risk: theme.risk,
        catalyst: theme.catalyst,
        source: theme.source,
      }));
    const candidates = state.recommendations.slice(0, 10).map((item) => ({
      code: item.code,
      name: item.name,
      sector: item.sector,
      price: item.quote?.price || null,
      changePct: item.quote?.changePct || null,
      score: item.score,
      reason: item.reason,
      risk: item.risk,
    }));
    const payload = await fetchJSON("/api/ai/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "A股",
        name: "本月板块与候选股",
        mode: "sector",
        context: {
          generatedAt: new Date().toISOString(),
          filters,
          monthMarketNotes,
          themes,
          candidates,
          discipline: [
            "优先风险控制，不把题材热度直接等同于买入信号",
            "价格筛选只作为资金门槛，最终需要回测、趋势、流动性和止损共同确认",
            "不能使用上下文之外的未来行情",
          ],
        },
      }),
    });
    $("aiSectorInsight").textContent = payload.content || "AI 未返回内容";
    $("aiSectorStatus").textContent = `${payload.model || state.aiConfig?.model || "AI"} · 已更新`;
  } catch (err) {
    $("aiSectorInsight").textContent = `AI 更新失败：${err.message}`;
    $("aiSectorStatus").textContent = "更新失败";
  } finally {
    $("aiSectorBtn").disabled = false;
  }
}

function renderAll(payload) {
  const matched = state.stocks.find((item) => item.code === payload.request.code);
  $("pageTitle").textContent = `${payload.request.code}${matched?.name ? ` · ${matched.name}` : ""} · 在线回测与三日预测`;
  ensureWatchItem(payload.request.code, matched?.name || "");
  if (!state.watchSnapshots[payload.request.code]) {
    refreshWatchlist().catch((err) => {
      $("aiMonitorStatus").textContent = err.message;
    });
  }
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
    state.charts[id] = echarts.init($(id), currentTheme() === "dark" ? "dark" : null, { renderer: "canvas" });
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

function axisStyle(showLabel = true) {
  const c = colors();
  return {
    axisLabel: { show: showLabel, color: c.muted },
    axisLine: { lineStyle: { color: c.axis } },
    splitLine: { lineStyle: { color: c.grid } },
  };
}

function legendStyle(data) {
  return { top: 5, data, textStyle: { color: colors().text } };
}

function levelLines(advice) {
  if (!advice) return [];
  const c = colors();
  const lines = [
    ["买入上沿", advice.buyHigh, c.green],
    ["买入下沿", advice.buyLow, c.green],
    ["确认线", advice.confirmLine, c.blue],
    ["不追线", advice.noChaseLine, c.gold],
    ["止损线", advice.stopLoss, c.red],
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
  const c = colors();
  const bars = payload.bars || [];
  const advice = payload.advice || {};
  const dates = bars.map((bar) => bar.date);
  const candles = bars.map((bar) => [bar.open, bar.close, bar.low, bar.high]);
  const buyMarks = (payload.trades || []).map((trade) => ({
    name: "买入",
    coord: [trade.entryDate, trade.entryPrice],
    value: "买",
    itemStyle: { color: c.red },
  }));
  const sellMarks = (payload.trades || []).map((trade) => ({
    name: "卖出",
    coord: [trade.exitDate, trade.exitPrice],
    value: "卖",
    itemStyle: { color: c.green },
  }));
  chart("kChart").setOption({
    animation: false,
    textStyle: { color: c.text },
    grid: [
      { left: 56, right: 24, top: 40, height: "60%" },
      { left: 56, right: 24, top: "75%", height: "15%" },
    ],
    tooltip: { trigger: "axis", axisPointer: { type: "cross" } },
    legend: legendStyle(["K线", "快线", "慢线", "布林上轨", "布林下轨", "成交量"]),
    xAxis: [
      { type: "category", data: dates, boundaryGap: true, ...axisStyle(true) },
      { type: "category", data: dates, gridIndex: 1, ...axisStyle(false) },
    ],
    yAxis: [
      { scale: true, ...axisStyle(true) },
      { scale: true, gridIndex: 1, ...axisStyle(true), axisLabel: { color: c.muted, formatter: (v) => `${v.toFixed(0)}万` } },
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
        itemStyle: { color: c.red, color0: c.green, borderColor: c.red, borderColor0: c.green },
        markPoint: { symbolSize: 30, data: [...buyMarks, ...sellMarks] },
        markLine: { symbol: "none", data: levelLines(advice), silent: true },
        markArea: buyMarkArea(advice),
      },
      { name: "快线", type: "line", data: bars.map((bar) => bar.fastMA || null), smooth: true, showSymbol: false, lineStyle: { color: c.blue } },
      { name: "慢线", type: "line", data: bars.map((bar) => bar.slowMA || null), smooth: true, showSymbol: false, lineStyle: { color: c.gold } },
      { name: "布林上轨", type: "line", data: bars.map((bar) => bar.bollUpper || null), showSymbol: false, lineStyle: { color: c.violet, type: "dashed", width: 1 } },
      { name: "布林下轨", type: "line", data: bars.map((bar) => bar.bollLower || null), showSymbol: false, lineStyle: { color: c.violet, type: "dashed", width: 1 } },
      { name: "成交量", type: "bar", xAxisIndex: 1, yAxisIndex: 1, data: bars.map((bar) => bar.volume / 10000), itemStyle: { color: c.axis } },
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
  const c = colors();
  const bars = recentBars(payload.bars || [], 100);
  const advice = payload.advice || {};
  const dates = bars.map((bar) => bar.date);
  const line = (value) => dates.map(() => (Number.isFinite(value) && value > 0 ? value : null));
  chart("actionChart").setOption({
    animation: false,
    textStyle: { color: c.text },
    tooltip: { trigger: "axis" },
    legend: legendStyle(["收盘价", "买入上沿", "买入下沿", "确认线", "止损线", "止盈1"]),
    grid: { left: 52, right: 24, top: 42, bottom: 38 },
    xAxis: { type: "category", data: dates, ...axisStyle(true) },
    yAxis: { type: "value", scale: true, ...axisStyle(true) },
    series: [
      { name: "收盘价", type: "line", data: bars.map((bar) => bar.close), showSymbol: false, lineStyle: { color: c.text, width: 2 } },
      { name: "买入上沿", type: "line", data: line(advice.buyHigh), showSymbol: false, lineStyle: { color: c.green } },
      { name: "买入下沿", type: "line", data: line(advice.buyLow), showSymbol: false, lineStyle: { color: c.green, type: "dashed" }, areaStyle: { color: "rgba(35,131,92,.08)" } },
      { name: "确认线", type: "line", data: line(advice.confirmLine), showSymbol: false, lineStyle: { color: c.blue } },
      { name: "止损线", type: "line", data: line(advice.stopLoss), showSymbol: false, lineStyle: { color: c.red, type: "dashed" } },
      { name: "止盈1", type: "line", data: line(advice.takeProfit1), showSymbol: false, lineStyle: { color: "#d97706" } },
    ],
  });
}

function renderIndicatorChart(payload) {
  const c = colors();
  const bars = recentBars(payload.bars || [], 140);
  const dates = bars.map((bar) => bar.date);
  chart("indicatorChart").setOption({
    animation: false,
    textStyle: { color: c.text },
    tooltip: { trigger: "axis" },
    legend: legendStyle(["RSI14", "MACD柱", "DIF", "DEA"]),
    grid: [
      { left: 52, right: 24, top: 42, height: "34%" },
      { left: 52, right: 24, top: "61%", height: "25%" },
    ],
    xAxis: [
      { type: "category", data: dates, ...axisStyle(false) },
      { type: "category", data: dates, gridIndex: 1, ...axisStyle(true) },
    ],
    yAxis: [
      { type: "value", min: 0, max: 100, ...axisStyle(true) },
      { type: "value", gridIndex: 1, scale: true, ...axisStyle(true) },
    ],
    series: [
      {
        name: "RSI14",
        type: "line",
        data: bars.map((bar) => bar.rsi14 || null),
        showSymbol: false,
        lineStyle: { color: c.blue, width: 2 },
        markLine: {
          symbol: "none",
          data: [
            { yAxis: 70, name: "过热", lineStyle: { color: c.red, type: "dashed" } },
            { yAxis: 50, name: "中轴", lineStyle: { color: c.muted, type: "dashed" } },
            { yAxis: 30, name: "超卖", lineStyle: { color: c.green, type: "dashed" } },
          ],
        },
      },
      {
        name: "MACD柱",
        type: "bar",
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: bars.map((bar) => bar.macdHist || 0),
        itemStyle: { color: (params) => (params.value >= 0 ? c.red : c.green) },
      },
      { name: "DIF", type: "line", xAxisIndex: 1, yAxisIndex: 1, data: bars.map((bar) => bar.macd || 0), showSymbol: false, lineStyle: { color: c.blue } },
      { name: "DEA", type: "line", xAxisIndex: 1, yAxisIndex: 1, data: bars.map((bar) => bar.macdSignal || 0), showSymbol: false, lineStyle: { color: c.gold } },
    ],
  });
}

function renderEquityChart(payload) {
  const c = colors();
  const bars = payload.bars || [];
  chart("equityChart").setOption({
    animation: false,
    textStyle: { color: c.text },
    tooltip: { trigger: "axis" },
    legend: legendStyle(["策略净值", "最大回撤"]),
    grid: { left: 56, right: 24, top: 42, bottom: 38 },
    xAxis: { type: "category", data: bars.map((bar) => bar.date), ...axisStyle(true) },
    yAxis: [
      { type: "value", scale: true, ...axisStyle(true) },
      { type: "value", ...axisStyle(true), axisLabel: { color: c.muted, formatter: (v) => `${(v * 100).toFixed(0)}%` } },
    ],
    dataZoom: [{ type: "inside", start: 55, end: 100 }],
    series: [
      { name: "策略净值", type: "line", data: bars.map((bar) => bar.equity), showSymbol: false, lineStyle: { color: c.blue, width: 2 } },
      { name: "最大回撤", type: "line", yAxisIndex: 1, data: bars.map((bar) => bar.drawdown), showSymbol: false, areaStyle: { color: "rgba(194,65,58,.12)" }, lineStyle: { color: c.red } },
    ],
  });
}

function renderForecastChart(forecast, bars) {
  if (!bars.length) return;
  const c = colors();
  const last = bars[bars.length - 1];
  const points = forecast.points || [];
  const dates = [last.date, ...points.map((p) => p.date)];
  const mean = [last.close, ...points.map((p) => p.meanClose)];
  chart("forecastChart").setOption({
    animation: false,
    textStyle: { color: c.text },
    tooltip: { trigger: "axis" },
    legend: legendStyle(["预测均值", "P20", "P80", "P10", "P90"]),
    grid: { left: 52, right: 24, top: 42, bottom: 38 },
    xAxis: { type: "category", data: dates, ...axisStyle(true) },
    yAxis: { type: "value", scale: true, ...axisStyle(true) },
    series: [
      { name: "预测均值", type: "line", data: mean, lineStyle: { color: c.blue, width: 3 } },
      { name: "P20", type: "line", data: [last.close, ...points.map((p) => p.p20)], lineStyle: { color: c.muted, type: "dashed" }, showSymbol: false },
      { name: "P80", type: "line", data: [last.close, ...points.map((p) => p.p80)], lineStyle: { color: c.muted, type: "dashed" }, showSymbol: false, areaStyle: { color: "rgba(35,106,138,.10)" } },
      { name: "P10", type: "line", data: [last.close, ...points.map((p) => p.p10)], lineStyle: { color: c.axis, type: "dotted" }, showSymbol: false },
      { name: "P90", type: "line", data: [last.close, ...points.map((p) => p.p90)], lineStyle: { color: c.axis, type: "dotted" }, showSymbol: false },
    ],
  });
}

function renderRiskChart(advice) {
  const c = colors();
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
    textStyle: { color: c.text },
    tooltip: { trigger: "axis", valueFormatter: (v) => `${v} 元/股` },
    grid: { left: 54, right: 18, top: 28, bottom: 40 },
    xAxis: { type: "category", data: rows.map(([name]) => name), ...axisStyle(true) },
    yAxis: { type: "value", ...axisStyle(true), axisLabel: { color: c.muted, formatter: (v) => `${v}` } },
    series: [
      {
        name: "单股盈亏",
        type: "bar",
        data,
        itemStyle: { color: (params) => (params.value >= 0 ? c.red : c.green) },
        label: { show: true, position: "top", formatter: "{c}", color: c.text },
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

window.addEventListener("resize", () => {
  Object.values(state.charts).forEach((c) => c.resize());
});

$("runBtn").addEventListener("click", runBacktest);
$("searchBtn").addEventListener("click", () => {
  const query = $("codeInput").value.trim();
  $("stockSearchInput").value = query;
  showPage("stock");
  if (state.stocks.length) {
    applyStockFilter();
  } else {
    loadStocks(query).catch((err) => status(err.message, true));
  }
});
$("navStock").addEventListener("click", () => showPage("stock"));
$("navAnalysis").addEventListener("click", () => showPage("analysis"));
$("themeToggle").addEventListener("click", () => setTheme(currentTheme() === "dark" ? "light" : "dark"));
$("stockRefreshBtn").addEventListener("click", () => loadStocks($("stockSearchInput").value.trim()).catch((err) => status(err.message, true)));
$("stockSearchInput").addEventListener("input", applyStockFilter);
$("stockTableBody").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-code]");
  if (!button) return;
  selectStock(button.dataset.code, button.dataset.name);
});
$("recommendationBody").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-code]");
  if (!button) return;
  selectStock(button.dataset.code, button.dataset.name);
});
$("sectorCompanyBody").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-code]");
  if (!button) return;
  selectStock(button.dataset.code, button.dataset.name);
});
$("watchBody").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-watch-remove]");
  if (!button) return;
  removeWatchItem(button.dataset.watchRemove);
});
["hotSectorGrid", "newsSectorGrid"].forEach((id) => {
  $(id).addEventListener("click", (event) => {
    const button = event.target.closest("button[data-sector]");
    if (!button) return;
    selectSector(button.dataset.sector);
  });
});
$("addWatchBtn").addEventListener("click", () => {
  const current = currentStockMeta();
  if (!current.code) {
    $("aiInsight").textContent = "请先选择股票";
    return;
  }
  ensureWatchItem(current.code, current.name);
  refreshWatchlist().catch((err) => {
    $("aiMonitorStatus").textContent = err.message;
  });
});
$("startMonitorBtn").addEventListener("click", startMonitor);
$("stopMonitorBtn").addEventListener("click", stopMonitor);
$("aiAnalyzeBtn").addEventListener("click", runAIAnalysis);
$("applyDiscoveryBtn").addEventListener("click", () => applyDiscoveryFilters(false));
$("refreshPricesBtn").addEventListener("click", () => refreshCandidateQuotes().catch((err) => {
  $("recommendationSummary").textContent = `价格刷新失败：${err.message}`;
}));
$("aiSectorBtn").addEventListener("click", runAISectorScan);
["sectorFilterSelect", "minPriceInput", "maxPriceInput", "riskFilterSelect", "minHeatInput"].forEach((id) => {
  $(id).addEventListener("change", () => applyDiscoveryFilters(false));
});

const initialParams = new URLSearchParams(window.location.search);
const initialCode = initialParams.get("code");
if (initialCode) {
  $("codeInput").value = initialCode;
}

initTheme();
renderWatchlist();
loadAIConfig();
if (initialCode && initialParams.get("run") === "1") {
  showPage("analysis");
  loadStocks()
    .catch((err) => status(err.message, true))
    .finally(() => runBacktest());
} else {
  showPage("stock");
  loadStocks().catch((err) => status(err.message, true));
}
