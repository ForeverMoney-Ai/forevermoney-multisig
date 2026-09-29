"""Build the Safe-hosted subnet display catalog from the ForeverMoney checkout."""
import json
import shutil
from pathlib import Path

source = Path('/Users/creatorbid/Documents/development/forevermoney')
target = Path(__file__).resolve().parent.parent / 'artifacts/metadata'
target.mkdir(parents=True, exist_ok=True)
(target / 'subnets').mkdir(exist_ok=True)
base = 'https://safe.forevermoney.ai/assets/metadata/'
snapshot = json.loads((source / 'src/config/subnets.snapshot.json').read_text())
shutil.copy2(source / 'src/assets/images/tokens/tao-token.png', target / 'tao.png')
tokens = []
for token in snapshot['tokens']:
    entry = {k: token[k] for k in ['netuid', 'symbol', 'name']}
    entry['address'] = None  # A subnet identity is not an ERC20 contract.
    if token.get('image'):
        image = source / 'public' / token['image'].lstrip('/')
        shutil.copy2(image, target / 'subnets' / image.name)
        entry['logoUri'] = base + 'subnets/' + image.name
    else:
        entry['logoUri'] = base + 'tao.png'
    tokens.append(entry)
catalog = {'source': 'ForeverMoney', 'fetchedAt': snapshot['fetchedAt'], 'subnets': tokens}
(target / 'subnets.json').write_text(json.dumps(catalog, indent=2) + '\n')
print(f'Exported {len(tokens)} subnet names and artwork, with TAO fallback.')
