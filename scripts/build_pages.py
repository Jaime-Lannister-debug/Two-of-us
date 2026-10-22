"""只将网页和浏览器公共配置打包到 GitHub Pages，不发布 SQL、备份或测试文件。"""
from pathlib import Path
import json
import os
import shutil
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
url = os.environ.get('SUPABASE_URL', '').strip().rstrip('/')
key = os.environ.get('SUPABASE_PUBLISHABLE_KEY', '').strip()
space = os.environ.get('SHARED_ID', 'our-shared-space').strip()
if not url or not key:
    raise SystemExit('请先在 Settings → Secrets and variables → Actions → Variables 设置 SUPABASE_URL 和 SUPABASE_PUBLISHABLE_KEY。')
parsed = urlsplit(url)
if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path:
    raise SystemExit('SUPABASE_URL 必须是项目的 HTTPS 根地址。')
if not key.startswith('sb_publishable_'):
    raise SystemExit('这里只接受 sb_publishable_ 开头的浏览器公共 key，禁止 secret/service_role。')
if not space:
    raise SystemExit('SHARED_ID 不能为空。')

output = ROOT / '_site'
if output.exists():
    shutil.rmtree(output)
output.mkdir()
for name in ['index.html', 'shared.html']:
    shutil.copyfile(ROOT / name, output / name)
for name in ['src', 'styles']:
    shutil.copytree(ROOT / name, output / name)
config = dict(SUPABASE_URL=url, SUPABASE_ANON_KEY=key, SHARED_ID=space, ACCESS_MODE='members')
receipt_worker = os.environ.get('LEDGER_RECEIPTS_WORKER_URL', '').strip()
if receipt_worker:
    receipt_parsed = urlsplit(receipt_worker)
    if receipt_parsed.scheme != 'https' or not receipt_parsed.hostname or receipt_parsed.username or receipt_parsed.password or receipt_parsed.query or receipt_parsed.fragment:
        raise SystemExit('LEDGER_RECEIPTS_WORKER_URL 必须是 HTTPS 地址。')
    config['LEDGER_RECEIPTS_WORKER_URL'] = receipt_worker
# 配置属于部署产物，不回写或提交 Git；浏览器运行时可见，这是公共 key 的用途。
(output / 'supabase-config.js').write_text('window.TWO_US_CONFIG = ' + json.dumps(config, ensure_ascii=False) + ';\n')
(output / '.nojekyll').touch()
print('Pages 产物已准备：页面骨架、src/ 模块、styles/ 样式、运行配置。')
