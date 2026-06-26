#!/usr/bin/env python3
"""Diagnostic audit — tests 5 representative models and shows missing sources."""
import asyncio
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from scraper import search, SWAPPIE_MODELS

async def audit():
    test_models = [
        'iPhone 12', 'iPhone 13 Pro',
        'iPhone 14 Pro', 'iPhone 15', 'iPhone 16 Pro Max'
    ]
    all_sources = [
        'Swappie', 'BackMarket', 'EasyCash', 'eRecycle',
        'MagicRecycle', 'Recommerce', 'CashExpress',
        'Greendid', 'CertiDeal', 'Asgoodasnew'
    ]
    for model in test_models:
        print(f'\n{"="*50}')
        print(f'MODEL: {model}')
        try:
            data = await search(model, force_refresh=True)
            sources = data.get('sources', [])
            raw = data.get('raw', [])
            print(f'Sources ({len(sources)}): {sources}')
            print(f'Total prices: {len(raw)}')
            missing = [s for s in all_sources if s not in sources]
            print(f'MISSING: {missing}')
        except Exception as e:
            print(f'ERROR: {e}')

asyncio.run(audit())
