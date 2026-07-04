# AData 股票回测工作台

一个用 Go 编写的本地股票回测与预测系统，配合 Python `adata` 拉取 A 股行情，提供在线 K 线、指标图、回测曲线、未来区间预测和交易执行建议。

## 功能

- A 股日线行情：优先使用 `adata.stock.market.get_market`，失败时使用备用数据源。
- 在线 K 线图：K 线、成交量、均线、布林带、历史买卖点、买入区和止损/止盈线。
- 回测引擎：收盘确认信号，下一交易日开盘模拟成交，包含费率和滑点。
- 指标体系：MA、RSI、MACD、Bollinger、ATR、量能比、净值和回撤。
- 未来几日预测：基于历史相似样本的区间分布，并使用 walk-forward 做方向命中率和误差评估。
- 决策面板：直接输出当前动作、买入区、确认线、不追线、止损、硬止损、止盈、建议股数和资金不足提示。

## 运行环境

- Go 1.22+
- Python 3.9+
- Python 依赖：

```bash
pip install adata pandas requests yfinance
```

如果系统中 Python 命令不是 `python`，可以指定：

```bash
set ADATA_PYTHON=C:\Path\To\python.exe
```

## 启动

```bash
go run ./cmd/server -addr :8088
```

打开：

```text
http://localhost:8088
```

## API

```text
GET  /api/health
GET  /api/stocks?q=华天&limit=300
GET  /api/market?code=002185&start=2024-01-01
POST /api/backtest
```

`POST /api/backtest` 示例：

```json
{
  "code": "002185",
  "start": "2024-01-01",
  "fastMA": 5,
  "slowMA": 20,
  "initialCash": 1500,
  "feeRate": 0.0003,
  "slippageRate": 0.0005,
  "forecastDays": 3
}
```

## 回测纪律

本系统避免未来函数的基本规则：

- 指标只使用当前 K 线及以前的数据。
- 交易信号在收盘后确认，成交在下一交易日开盘价模拟。
- 预测特征不包含未来收益。
- walk-forward 评估只使用当时之前的训练样本。

## 风险声明

该系统用于研究、回测和可视化，不构成投资建议。股票预测只能给出概率与区间，不能保证未来走势。实际交易需要结合流动性、公告、市场环境和个人风险承受能力。
