from chains.models import Chain

Chain.objects.filter(id=964).update(currency_logo_uri='tao.png', chain_logo_uri='tao.png')
print('Updated Bittensor and TAO logos; cfg MEDIA_URL must point at the public metadata directory.')
