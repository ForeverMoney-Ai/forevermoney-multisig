"""Set crawler-visible, site-wide social metadata on every static export page."""
import re
import shutil
import sys
from pathlib import Path

root = Path(sys.argv[1])
image_url = 'https://safe.forevermoney.ai/images/safe-opengraph-v1.jpg'
title = 'ForeverMoney Safe | Your TAO. Your Safe.'
description = 'Manage your TAO and subnet tokens with Safe multisig on Bittensor Finney.'
values = {
    'og:type': 'website', 'og:url': 'https://safe.forevermoney.ai/', 'og:site_name': 'ForeverMoney Safe',
    'og:title': title, 'og:description': description, 'og:image': image_url,
    'og:image:width': '1200', 'og:image:height': '630',
    'og:image:type': 'image/jpeg', 'og:image:alt': 'ForeverMoney Safe — Your TAO. Your Safe.',
    'twitter:card': 'summary_large_image', 'twitter:site': '@forevermoney_ai',
    'twitter:title': title, 'twitter:description': description,
    'twitter:image': image_url, 'twitter:image:alt': 'ForeverMoney Safe — Your TAO. Your Safe.',
}
meta = ''.join(f'<meta {"property" if k.startswith("og:") else "name"}="{k}" content="{v}"/>' for k, v in values.items())
for path in root.rglob('*.html'):
    text = path.read_text()
    text = re.sub(r'<meta\b[^>]*(?:name|property)=[\"\'](?:og:|twitter:)[^\"\']*[\"\'][^>]*>', '', text, flags=re.I)
    text = re.sub(r'<title\b[^>]*>.*?</title>', '', text, flags=re.I | re.S)
    text = re.sub(r'<meta\b[^>]*name=[\"\']description[\"\'][^>]*>', '', text, flags=re.I)
    # Put crawler essentials first, independent of client-side app initialization.
    basics = f'<title>{title}</title><meta name="description" content="{description}"/>'
    text = text.replace('<head>', '<head>' + basics + meta)
    path.write_text(text)
(root / 'images').mkdir(exist_ok=True)
shutil.copyfile(Path(__file__).parent / 'assets/safe-opengraph-v1.jpg', root / 'images/safe-opengraph-v1.jpg')
print('Applied social metadata and image to static export')
