"""验证前端语法与数据层，不连接真实 Supabase。"""
from pathlib import Path
import json
import re
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
html = (ROOT / 'shared.html').read_text()
assert 'const seeds' not in html and 'switchCatalog' not in html
assert ' onerror=' not in html
assert 'role="dialog" aria-modal="true"' in html
assert 'searchDebounce=setTimeout' in html
assert "event:'UPDATE'" in html
assert 'src="./supabase-config.js"' in html
assert 'sb_publishable_' not in html
assert not re.search(r'new Date\(2026\s*,\s*9\s*,\s*1\)', html)
assert 'ACCESS_MODE' in (ROOT / 'supabase-config.example.js').read_text()

script = '\n'.join(re.findall(r'<script>(.*?)</script>', html, re.S))
start = html.index('// 配置唯一来源')
end = html.index('void initSharedCloud();', start) + len('void initSharedCloud();')
backend = html[start:end].replace('void initSharedCloud();', '')
fixture = (ROOT / 'tests/cloud-stubs.js').read_text() + backend + (ROOT / 'tests/cloud-assertions.js').read_text()

menu_fixture=(ROOT / 'tests/menu-stubs.js').read_text() + backend + (ROOT / 'tests/menu-events.js').read_text()

node = shutil.which('node')
jsc = Path('/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc')
if not node and not jsc.exists():
    raise SystemExit('源码检查通过；运行 JS 检查还需要 Node.js 或 macOS JavaScriptCore。')

with tempfile.TemporaryDirectory(prefix='two-us-check-') as directory:
    folder = Path(directory)
    syntax = folder / 'syntax.js'
    syntax.write_text(script)
    test = folder / 'data-layer.js'
    menu_test = folder / 'menu-events.js'
    menu_test.write_text(menu_fixture)
    if node:
        # 兼容现有测试的 JavaScriptCore 输出接口。
        test.write_text('const print=console.log;const quit=code=>process.exit(code);\n' + fixture)
        subprocess.run([node, '--check', str(syntax)], check=True)
        subprocess.run([node, str(test)], check=True)
        subprocess.run([node, str(menu_test)], check=True)
        subprocess.run([node, str(ROOT / 'tests/cover-upload.mjs')], check=True)
        subprocess.run([node, str(ROOT / 'tests/travel-map.mjs')], check=True)
    else:
        syntax.write_text('new Function(' + json.dumps(script) + ');print("PASS: script syntax");')
        test.write_text(fixture)
        subprocess.run([str(jsc), str(syntax)], check=True)
        subprocess.run([str(jsc), str(test)], check=True)
        subprocess.run([str(jsc), str(menu_test)], check=True)
print('PASS: 源码、语法和模拟数据层检查完成；未连接真实数据库。')
