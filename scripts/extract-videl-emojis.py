"""Extract only literal catalogue data from a pinned Videl0 checkout (never import it).
Usage: python3 scripts/extract-videl-emojis.py /path/to/Videl0
"""
import ast
import json
from pathlib import Path
import sys

root = Path(sys.argv[1])
source = 'videl/utils/premium_emojis.py'
values = {}
for node in ast.parse((root / source).read_text()).body:
    if isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
        if node.target.id in {'PREMIUM_IDS', 'FALLBACK', 'ADDITIONAL_EMOJIS', 'SUPPLIED_EMOJI_PACKS'}:
            values[node.target.id] = ast.literal_eval(node.value)
ids, fallbacks = values['PREMIUM_IDS'], values['FALLBACK']
for alias, (glyph, identifier) in values['ADDITIONAL_EMOJIS'].items():
    ids[alias], fallbacks[alias] = identifier, glyph
for pack, rows in values['SUPPLIED_EMOJI_PACKS'].items():
    for index, row in enumerate(rows.strip().splitlines(), 1):
        glyph, identifier = row.rsplit(maxsplit=1)
        alias = f'{pack}_{index:03d}'
        ids[alias], fallbacks[alias] = identifier, glyph
catalog = {alias: {'id': identifier, 'fallback': fallbacks[alias]} for alias, identifier in ids.items()}
for item in catalog.values():
    assert item['id'].isdigit() and 0 < int(item['id']) <= 9223372036854775807 and item['fallback']
output = Path('packages/bot-ui/custom-emojis')
output.mkdir(parents=True, exist_ok=True)
(output / 'catalog.ts').write_text('// Generated literal data; regenerate with scripts/extract-videl-emojis.py.\n'
    '// Source: Beasgohan-code/Videl0@6430b1e5e60e0776a7ab519e05cb98c2ca1a2ebf\n'
    '// User-supplied IDs: NewsEmoji, tgiosicons, @rijif, SoLo_HaMiD and supplied packs.\n'
    'export const EMOJIS = '+json.dumps(catalog, ensure_ascii=False, indent=2)+' as const;\n'
    'export type EmojiName = keyof typeof EMOJIS;\n')
print(f'{len(catalog)} aliases; {len(set(ids.values()))} unique custom emoji IDs')
