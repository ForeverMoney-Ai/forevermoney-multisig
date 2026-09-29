from django.core.files.base import ContentFile
from safe_apps.models import SafeApp, Provider, Client, Tag
provider, _ = Provider.objects.get_or_create(url='https://forevermoney.ai', defaults={'name': 'ForeverMoney'})
app, created = SafeApp.objects.update_or_create(url='https://safe.forevermoney.ai/tx-builder', defaults={
    'name': 'Transaction Builder', 'description': 'Compose custom transactions with the open-source Transaction Builder, hosted by ForeverMoney.',
    'chain_ids': [964], 'listed': True, 'provider': provider,
    'developer_website': 'https://github.com/safe-global/safe-react-apps',
})
client, _ = Client.objects.get_or_create(url='https://safe.forevermoney.ai')
app.exclusive_clients.set([client])
if created:
    with open('/tmp/tx-builder.png', 'rb') as f:
        app.icon_url.save('tx-builder.png', ContentFile(f.read()), save=True)
tag, _ = Tag.objects.get_or_create(name='transaction-builder')
tag.safe_apps.add(app)
print('Registered self-hosted Transaction Builder', app.app_id)
