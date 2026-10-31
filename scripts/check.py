"""静态检查与真实模块测试；不读取真实配置或访问正式数据库。"""
from pathlib import Path
import re
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
html = (ROOT / 'shared.html').read_text()
assert not re.search(r'<script>(.*?)</script>', html, re.S), '业务脚本不能回到 HTML 内'
assert '<style>' not in html, '样式必须放入 styles/'
assert 'type="module"' in html and './src/main.js' in html
assert './styles/app.css' in html and './supabase-config.js' in html
source_files = list((ROOT / 'src').rglob('*.js'))
project_map = (ROOT / 'project map.md').read_text()
for path in source_files:
    assert path.relative_to(ROOT).as_posix() in project_map, f'新增源码必须在 project map.md 补功能行：{path.relative_to(ROOT)}'
for path in (ROOT / 'styles').glob('*.css'):
    assert path.relative_to(ROOT).as_posix() in project_map, f'样式需登记地图：{path.name}'
source = '\n'.join(p.read_text() for p in source_files)
assert 'switchCatalog' not in source and 'const seeds' not in source
assert ' onerror=' not in source
assert 'sb_publishable_' not in source
assert "replace_shared_item" in source and 'p_expected_content' in source
assert "event: 'UPDATE'" in source or 'event: "UPDATE"' in source
assert 'setTimeout' in source and '200' in source
for p in source_files:
    text = p.read_text()
    for ref in re.findall(r'from\s+[\'\"]([^\'\"]+)[\'\"]', text):
        if ref.startswith('.'):
            assert (p.parent / ref).is_file(), f'模块引用不存在：{p}: {ref}'

node = shutil.which('node')
if not node:
    raise SystemExit('原生模块检查需要 Node.js 22；安装后运行 npm ci --ignore-scripts && npm test。')
for path in source_files:
    subprocess.run([node, '--check', str(path)], check=True)
for name in ['app-contract.mjs', 'cloud.mjs', 'menu.mjs', 'cover-upload.mjs', 'travel-map.mjs', 'details-and-music.mjs', 'mood-bottles.mjs', 'r2-resilience.mjs', 'milestones-page.mjs', 'milestone-memories-ui.mjs', 'ledger-money.mjs', 'ledger-ui.mjs', 'ledger-worker.mjs', 'ui-parity.mjs', 'build.mjs']:
    subprocess.run([node, str(ROOT / 'tests' / name)], check=True)
print('PASS: 静态结构、模块语法、功能及构建检查；未连接正式数据库。')
