#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Small JSON bridge from Go to the Python adata SDK."""

from __future__ import annotations

import argparse
import json
import os
import sys


def emit(payload: dict) -> None:
    print(json.dumps(payload, ensure_ascii=False, separators=(",", ":")))


def fallback_stocks() -> list[dict]:
    return [
        {"code": "002185", "name": "华天科技", "exchange": "SZ"},
        {"code": "600129", "name": "太极集团", "exchange": "SH"},
        {"code": "000001", "name": "平安银行", "exchange": "SZ"},
        {"code": "600519", "name": "贵州茅台", "exchange": "SH"},
        {"code": "300750", "name": "宁德时代", "exchange": "SZ"},
        {"code": "000858", "name": "五粮液", "exchange": "SZ"},
    ]


def normalize_code(code: str) -> str:
    code = code.strip().upper()
    if "." in code:
        return code.split(".")[0]
    return code


def yahoo_symbol(code: str) -> str:
    code = normalize_code(code)
    if code.startswith(("6", "9")):
        return f"{code}.SS"
    return f"{code}.SZ"


def run_stocks(_: argparse.Namespace) -> None:
    east = load_stocks_eastmoney()
    if east:
        emit({"items": east, "source": "eastmoney-fast-list"})
        return
    if os.environ.get("ADATA_SLOW_STOCK_LIST") != "1":
        emit({"items": fallback_stocks(), "source": "fallback-fast-list"})
        return
    try:
        import adata

        df = adata.stock.info.all_code()
        if df is None or df.empty:
            emit({"items": fallback_stocks(), "source": "fallback"})
            return
        rows = []
        for row in df.to_dict("records"):
            rows.append(
                {
                    "code": str(row.get("stock_code", "")).zfill(6),
                    "name": str(row.get("short_name", "")),
                    "exchange": str(row.get("exchange", "")),
                }
            )
        emit({"items": rows, "source": "adata.stock.info.all_code"})
    except Exception as exc:  # noqa: BLE001
        emit({"items": fallback_stocks(), "source": f"fallback: {exc}"})


def load_stocks_eastmoney() -> list[dict]:
    try:
        import requests

        url = "https://80.push2.eastmoney.com/api/qt/clist/get"
        params = {
            "pn": "1",
            "pz": "10000",
            "po": "1",
            "np": "1",
            "ut": "bd1d9ddb04089700cf9c27f6f7426281",
            "fltt": "2",
            "invt": "2",
            "fid": "f3",
            "fs": "m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23",
            "fields": "f12,f14",
        }
        res = requests.get(url, params=params, headers={"User-Agent": "Mozilla/5.0"}, timeout=12)
        res.raise_for_status()
        diff = res.json().get("data", {}).get("diff", [])
        rows = []
        for item in diff:
            code = str(item.get("f12", "")).zfill(6)
            if not code or code == "000000":
                continue
            rows.append({"code": code, "name": str(item.get("f14", "")), "exchange": "SH" if code.startswith("6") else "SZ"})
        return rows
    except Exception:
        return []


def run_market(args: argparse.Namespace) -> None:
    code = normalize_code(args.code)
    try:
        import adata

        df = adata.stock.market.get_market(stock_code=code, start_date=args.start, k_type=args.ktype)
        if df is not None and not df.empty:
            if args.end:
                df = df[df["trade_date"].astype(str) <= args.end]
            emit({"items": normalize_market_records(df), "source": "adata.stock.market.get_market"})
            return
    except Exception:
        pass

    emit({"items": load_market_yfinance(code, args.start, args.end), "source": "yfinance-fallback"})


def normalize_market_records(df) -> list[dict]:
    rows = []
    for row in df.to_dict("records"):
        date_value = row.get("trade_date") or row.get("date") or row.get("trade_time")
        rows.append(
            {
                "date": str(date_value)[:10],
                "open": number(row.get("open")),
                "high": number(row.get("high")),
                "low": number(row.get("low")),
                "close": number(row.get("close")),
                "volume": number(row.get("volume")),
                "amount": number(row.get("amount")),
                "changePct": number(row.get("change_pct")),
            }
        )
    rows.sort(key=lambda item: item["date"])
    return rows


def load_market_yfinance(code: str, start: str, end: str | None) -> list[dict]:
    import yfinance as yf

    df = yf.download(yahoo_symbol(code), start=start, end=end, interval="1d", auto_adjust=False, progress=False, threads=False)
    if df is None or df.empty:
        return []
    if hasattr(df.columns, "get_level_values"):
        df.columns = df.columns.get_level_values(0)
    df = df.reset_index()
    rows = []
    for row in df.to_dict("records"):
        date_value = row.get("Date")
        if hasattr(date_value, "strftime"):
            date_text = date_value.strftime("%Y-%m-%d")
        else:
            date_text = str(date_value)[:10]
        close = number(row.get("Close"))
        volume = number(row.get("Volume"))
        rows.append(
            {
                "date": date_text,
                "open": number(row.get("Open")),
                "high": number(row.get("High")),
                "low": number(row.get("Low")),
                "close": close,
                "volume": volume,
                "amount": close * volume,
                "changePct": 0,
            }
        )
    return rows


def number(value) -> float:
    try:
        if value is None:
            return 0.0
        if value != value:
            return 0.0
        return float(value)
    except Exception:
        return 0.0


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("stocks")
    market = sub.add_parser("market")
    market.add_argument("--code", required=True)
    market.add_argument("--start", default="2021-01-01")
    market.add_argument("--end", default="")
    market.add_argument("--ktype", type=int, default=1)
    args = parser.parse_args(argv)
    if args.command == "stocks":
        run_stocks(args)
    elif args.command == "market":
        run_market(args)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
