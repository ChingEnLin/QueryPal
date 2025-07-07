from fastapi import APIRouter
from services.azure_cosmos_resources import ALL_CACHES

router = APIRouter()

@router.post("/clear_cache")
def clear_all_caches():
    for cache in ALL_CACHES:
        cache.clear()
    return {"status": "success", "message": "All caches cleared"}