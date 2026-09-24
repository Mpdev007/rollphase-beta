#!/usr/bin/env python3
"""Local page reader for RollPhase.

The map search finds a place. This reads that place's own public page and
returns a phone or hours only when the page itself states them. It does not
guess. Private and loopback addresses are refused. Results are cached.
"""
from __future__ import annotations

import json
import re
import socket
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

HOST = "127.0.0.1"
PORT = 8877
ROOT = Path(__file__).resolve().parent
CACHE_PATH = ROOT / ".enrich-cache.json"
PHONE_RE = re.compile(
    r"(?:\+?1[\s\-.]*)?(?:\(?\d{3}\)?[\s\-.]*)\d{3}[\s\-.]*\d{4}"
)
TIME_RE = re.compile(
    r"\b\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*[-–to]+\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b",
    re.I,
)
DAY_RE = re.compile(
    r"\b(mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b",
    re.I,
)
GENERIC = re.compile(r"^(call|call us|phone|tel|telephone|contact|click|here|link|more)\W*$", re.I)


def blocked_host(host: str) -> bool:
    host = (host or "").lower().rstrip(".")
    if not host or host in {"localhost", "localhost.localdomain"}:
        return True
    if host.endswith((".localhost", ".local", ".internal")):
        return True
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror:
        return True
    for info in infos:
        ip = info[4][0]
        if ip == "::1" or ip.startswith("fe80:") or ip.startswith("fc") or ip.startswith("fd"):
            return True
        parts = ip.split(".")
        if len(parts) != 4:
            continue
        try:
            a, b, c, d = (int(x) for x in parts)
        except ValueError:
            return True
        if max(a, b, c, d) > 255:
            return True
        if a in (0, 10, 127) or (a == 169 and b == 254) or (a == 172 and 16 <= b <= 31):
            return True
        if a == 192 and b == 168:
            return True
        if a == 100 and 64 <= b <= 127:
            return True
    return False


def norm_phone(raw: str) -> str:
    digits = re.sub(r"\D", "", raw or "")
    if len(digits) == 11 and digits.startswith("1"):
        digits = digits[1:]
    if len(digits) != 10:
        return ""
    if digits[0] not in "23456789" or digits[3] not in "23456789":
        return ""
    if digits[1] == "1" and digits[2] == "1":
        return ""
    return f"{digits[:3]}-{digits[3:6]}-{digits[6:]}"


def hours_snippet(text: str) -> str:
    lines = [re.sub(r"\s+", " ", ln).strip() for ln in (text or "").splitlines()]
    hits = []
    for i, ln in enumerate(lines):
        if not TIME_RE.search(ln):
            continue
        window = " ".join(lines[max(0, i - 1) : i + 2])
        if DAY_RE.search(window) or re.search(r"\bhours?\b", window, re.I):
            hits.append(ln)
        if len(hits) >= 3:
            break
    snippet = " · ".join(hits).strip()
    return snippet[:220]


def open_now(hours: str):
    if not hours:
        return None
    if re.search(r"24\s*/\s*7|open\s+24", hours, re.I):
        return True
    return None


def looks_blocked(status: int, text: str) -> bool:
    if status >= 400 or status == 0:
        return True
    low = (text or "").lower()
    if len(low) < 400:
        return True
    return any(
        mark in low
        for mark in (
            "just a moment",
            "cf-browser-verification",
            "challenge-platform",
            "enable javascript",
            "attention required",
            "access denied",
        )
    )


def page_text(page) -> str:
    text = ""
    try:
        text = page.markdown(main_content_only=True) or ""
    except Exception:
        text = ""
    if len(text) < 80:
        try:
            text = page.get_all_text() or ""
        except Exception:
            text = ""
    return text


def fetch_plain(url: str):
    from scrapling.fetchers import Fetcher

    page = Fetcher.get(url, impersonate="chrome", stealthy_headers=True, timeout=18)
    status = int(getattr(page, "status", 0) or 0)
    return page, status, page_text(page), "plain"


def fetch_stealth(url: str):
    from scrapling.fetchers import StealthyFetcher

    page = StealthyFetcher.fetch(
        url,
        headless=True,
        solve_cloudflare=True,
        network_idle=True,
        timeout=25,
    )
    status = int(getattr(page, "status", 0) or 0)
    return page, status, page_text(page), "stealth"


def read_page(url: str) -> dict:
    page, status, text, via = fetch_plain(url)
    if looks_blocked(status, text):
        try:
            page, status, text, via = fetch_stealth(url)
        except Exception:
            via = "plain"
    phone = ""
    label = ""
    try:
        for a in page.css("a[href^='tel:']") or []:
            href = ""
            try:
                href = a.attrib.get("href") or ""
            except Exception:
                href = ""
            phone = norm_phone(href.replace("tel:", ""))
            if phone:
                try:
                    label = re.sub(r"\s+", " ", a.get_all_text() or "").strip()[:80]
                except Exception:
                    label = ""
                break
    except Exception:
        pass
    if not phone:
        for m in PHONE_RE.finditer(text or ""):
            pre = re.sub(r"\s+", " ", (text or "")[max(0, m.start() - 80) : m.start()]).strip()
            bit = pre.split(".")[-1].strip(" -:·")[-80:]
            if not bit or len(bit) < 3 or GENERIC.match(bit):
                continue
            phone = norm_phone(m.group())
            if phone:
                label = bit
                break
    hours = hours_snippet(text)
    return {
        "url": url,
        "phone": phone,
        "phoneLabel": label if phone else "",
        "hours": hours,
        "open": open_now(hours),
    }


def load_cache() -> dict:
    try:
        return json.loads(CACHE_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}


def save_cache(cache: dict) -> None:
    CACHE_PATH.write_text(json.dumps(cache), encoding="utf-8")


class Handler(BaseHTTPRequestHandler):
    def _send(self, code: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self) -> None:
        if self.path.split("?")[0] != "/enrich":
            self._send(404, {"results": []})
            return
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(min(length, 200_000))
        try:
            body = json.loads(raw.decode("utf-8") or "{}")
        except Exception:
            self._send(400, {"results": []})
            return
        urls = []
        for url in body.get("urls") or []:
            if not isinstance(url, str) or not url.startswith(("http://", "https://")):
                continue
            host = urlparse(url).hostname or ""
            if blocked_host(host):
                continue
            urls.append(url)
            if len(urls) >= 6:
                break
        cache = load_cache()
        results = []
        for url in urls:
            if url in cache:
                results.append(cache[url])
                continue
            try:
                row = read_page(url)
            except Exception:
                row = {"url": url, "phone": "", "phoneLabel": "", "hours": "", "open": None}
            cache[url] = row
            results.append(row)
        save_cache(cache)
        self._send(200, {"results": results})

    def log_message(self, fmt: str, *args) -> None:
        return


if __name__ == "__main__":
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
