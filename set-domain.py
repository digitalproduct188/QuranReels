#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
تبديل نطاق الموقع في كل الملفات دفعة واحدة.

الاستخدام:
    python3 set-domain.py https://ayat.example.com

يحدّث: canonical · og:url · twitter:url · sitemap.xml · robots.txt
في جميع صفحات HTML والملفات المرتبطة.
"""

import os
import re
import sys
from urllib.parse import urlparse

OLD_DEFAULT = "https://ayat-reels.netlify.app"

ROOT = os.path.dirname(os.path.abspath(__file__))
EXTS = (".html", ".xml", ".txt", ".webmanifest", ".json")
SKIP_DIRS = {".git", "node_modules", "__pycache__", ".netlify", "functions", "netlify"}


def normalize(url: str) -> str:
    url = url.strip().rstrip("/")
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        sys.exit("خطأ: اكتب نطاقاً كاملاً يبدأ بـ https:// مثل: https://ayat.example.com")
    return f"{parsed.scheme}://{parsed.netloc}"


def discover_old_hosts(files):
    hosts = set()
    pattern = re.compile(r"https://([a-z0-9.-]+\.[a-z]{2,})", re.I)
    for path in files:
        try:
            text = open(path, encoding="utf-8").read()
        except (UnicodeDecodeError, OSError):
            continue
        for host in pattern.findall(text):
            # تجاهل نطاقات المكتبات والخطوط والخدمات الخارجية
            if host.endswith(
                (
                    "googleapis.com",
                    "gstatic.com",
                    "alquran.cloud",
                    "everyayah.com",
                    "pexels.com",
                    "islamic.network",
                    "schema.org",
                    "w3.org",
                    "github.com",
                    "cloudflare.com",
                    "netlify.com",
                    "netlify.app",
                )
            ):
                continue
            hosts.add(host)
        break
    return hosts


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    new = normalize(sys.argv[1])

    files = []
    for base, dirs, names in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith(".")]
        for name in names:
            if name.endswith(EXTS):
                files.append(os.path.join(base, name))

    # النطاقات القديمة: النطاق الافتراضي + أي نطاق يظهر في canonical
    old_hosts = {urlparse(OLD_DEFAULT).netloc}
    canon = re.compile(r'<link[^>]+rel="canonical"[^>]+href="https://([^/"]+)')
    for path in files:
        try:
            text = open(path, encoding="utf-8").read()
        except (UnicodeDecodeError, OSError):
            continue
        old_hosts.update(canon.findall(text))

    changed = 0
    for path in files:
        try:
            text = open(path, encoding="utf-8").read()
        except (UnicodeDecodeError, OSError):
            continue
        original = text
        for host in old_hosts:
            text = text.replace(f"https://{host}", new)
        if text != original:
            open(path, "w", encoding="utf-8").write(text)
            changed += 1

    print(f"تم التحديث إلى: {new}")
    print(f"الملفات المعدّلة: {changed}")
    print("الخطوة التالية: أعد الرفع إلى Netlify / Cloudflare / GitHub.")


if __name__ == "__main__":
    main()
