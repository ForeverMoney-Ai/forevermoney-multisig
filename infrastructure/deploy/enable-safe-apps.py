from chains import models
from chains.models import Chain, Feature
chain = Chain.objects.get(id=964)
feature, _ = Feature.objects.get_or_create(key="SAFE_APPS")
feature.chains.add(chain)
# cfg v2.91.0 (MIT) has no Service model or Feature.services; features apply to all clients.
Service = getattr(models, "Service", None)
if Service and hasattr(feature, "services"):
    for key in ["WALLET_WEB", "cgw"]:
        service, _ = Service.objects.get_or_create(key=key, defaults={"name": key})
        feature.services.add(service)
print("Enabled embedded apps for Finney (964)")
