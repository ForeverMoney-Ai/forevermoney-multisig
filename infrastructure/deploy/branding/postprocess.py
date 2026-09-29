"""Local output branding; the original Safe postprocessor remains unchanged."""
import sys,re,shutil
from pathlib import Path
root=Path(sys.argv[1]); mode=sys.argv[2]
if mode=='safe':sys.exit(0)
for p in root.rglob('*.html'):
 s=p.read_text()
 s=s.replace('ForeverMoney Safe','ForeverMoney Multi-sig').replace('Your TAO. Your Safe.','Your TAO. Your Multi-sig.').replace('with Safe multisig','with multisig accounts').replace('/images/safe-opengraph-v1.jpg','/images/forevermoney/opengraph-multisig-v1.jpg')
 # Cache bust icons when swapping modes, without changing their dimensions.
 s=re.sub(r'(href="/favicons/[^"?]+)(")',r'\1?brand=forevermoney-v1\2',s)
 p.write_text(s)
# Old image URL must not keep advertising the old logo in this mode.
shutil.copyfile(root/'images/forevermoney/opengraph-multisig-v1.jpg',root/'images/safe-opengraph-v1.jpg')
print('Multi-sig local metadata applied')
