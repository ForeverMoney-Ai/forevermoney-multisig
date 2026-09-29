"""Run with the transaction service's manage.py shell; contract identities verified on chain 964."""
from django.db import transaction
from safe_transaction_service.tokens.models import Token

base = 'https://safe.forevermoney.ai/assets/metadata/'
rows = [
    ('0xC5b6C1632d34901239396F5E1BDe54B342900256', 'Wrapped TAO', 'wTAO', 'tao.png'),
    ('0xcd0836D1ecE4AEDf5B39f2792e0790BBE79449b3', 'Pareton', 'SN10', 'subnets/sn10.webp'),
    ('0xfD628dE75EF96f0A5C59659159C6cA81E0DC2222', 'OpenRoboto', 'SN80', 'subnets/sn80.webp'),
]
with transaction.atomic():
    for address, name, symbol, logo in rows:
        token, _ = Token.objects.get_or_create(address=address, defaults={'decimals': 18})
        token.name, token.symbol, token.logo_uri = name, symbol, base + logo
        token.save(update_fields=['name', 'symbol', 'logo_uri'])
        print(address, name, symbol)
