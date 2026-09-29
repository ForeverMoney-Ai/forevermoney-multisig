"""Apply the narrow-screen address card sizing to a Safe static export."""
import sys
import re
from pathlib import Path

root = Path(sys.argv[1])
css = '''<style id="safe-brand-mobile">img[alt="Bittensor Logo"]{filter:invert(1);border-radius:50%}[data-testid="safe-selector-trigger-details"] span:has(>[data-testid="copy-ss58-btn"]),[data-testid="safe-selector-trigger-details"] span:has(>[data-testid="copy-address-btn"]){opacity:1!important;pointer-events:auto!important}@media(max-width:639px){[data-testid="safe-level-navigation"]{min-width:0;max-width:calc(100vw - 32px)}[data-testid="safe-level-navigation"]>div{width:100%;min-width:0;max-width:100%}}</style>'''
# Hide the upstream Safe developer portal promotion in both sidebar states.
css = css.replace('</style>', '[data-slot="sidebar-menu-item"]:has([data-testid="api-cta-collapsed"]),[data-slot="sidebar-menu-item"]:has([data-testid="api-cta-sidebar"]){display:none!important}</style>')
# Stable semantic selectors let a purely visual adjustment ship without changing JS.
shell_css = '<style id="safe-brand-shell-solid">:root{--fm-header:60px;--fm-footer:44px}@media(max-width:767.95px){:root{--fm-header:56px}}header[aria-label="ForeverMoney"],footer[aria-label="ForeverMoney footer"]{background:rgb(5 6 8)!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;box-sizing:border-box}header[aria-label="ForeverMoney"]{border-bottom:1px solid #232529}footer[aria-label="ForeverMoney footer"]{border-top:1px solid #232529}</style>'
for path in root.rglob('*.html'):
    text = path.read_text()
    text = re.sub(r'<style id="safe-brand-mobile">.*?</style>', '', text, flags=re.S)
    text = re.sub(r'<style id="safe-brand-shell-solid">:root{--fm-header:60px;--fm-footer:44px}@media(max-width:767.95px){:root{--fm-header:56px}}.*?</style>', '', text, flags=re.S)
    path.write_text(text.replace('</head>', css + shell_css + '</head>'))

# Include crawler-visible social metadata in every future export.
import subprocess
subprocess.run([sys.executable, str(Path(__file__).with_name("brand-opengraph.py")), str(root)], check=True)
