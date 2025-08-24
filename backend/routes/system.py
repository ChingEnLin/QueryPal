from fastapi import APIRouter
from services.azure_cosmos_resources import ALL_CACHES
from services.data_documents_service import ALL_DOCUMENTS_CACHES

router = APIRouter()


@router.post("/clear_cache")
def clear_all_caches():
    for cache in ALL_CACHES:
        cache.clear()
    return {"status": "success", "message": "All caches cleared"}


@router.post("/clear_documents_cache")
def clear_all_documents_caches():
    for cache in ALL_DOCUMENTS_CACHES:
        cache.clear()
    return {"status": "success", "message": "All documents caches cleared"}
