from pathlib import Path
import sys
root=Path(sys.argv[1])
p=root/'apps/tx-builder/src/lib/getAbi.ts'
s=p.read_text().replace('https://safe-client.safe.global/v1/chains/', 'https://safe.forevermoney.ai/cgw/v1/chains/')
p.write_text(s)
p=root/'apps/tx-builder/src/index.tsx'
s=p.read_text().replace("import ReactDOM from 'react-dom'", "import ReactDOM from 'react-dom'\nimport { setBaseUrl } from '@safe-global/safe-gateway-typescript-sdk'")
s=s.replace('ReactDOM.render(', "setBaseUrl('https://safe.forevermoney.ai/cgw')\n\nReactDOM.render(")
p.write_text(s)

p=root/'apps/tx-builder/src/index.tsx'
s=p.read_text().replace('<SafeProvider>', r'<SafeProvider opts={{ allowedDomains: [/^https:\/\/safe\.forevermoney\.ai$/] }}>')
p.write_text(s)
