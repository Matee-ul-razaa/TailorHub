import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .database import get_db
from .deps import require_role
from .models import Product, User, UserRole
from .schemas import ProductIn, ProductOut

router = APIRouter(prefix="/api/products", tags=["products"])


def _to_product_out(item: Product) -> ProductOut:
    return ProductOut(
        id=item.id,
        name=item.name,
        description=item.description,
        price=item.price,
        category=item.category,
        wearType=item.wear_type,
        image=item.image,
        availableModes=json.loads(item.available_modes),
        fabric=item.fabric,
        colors=json.loads(item.colors),
        sizes=json.loads(item.sizes),
        featured=item.featured,
        hasWaistcoatOption=item.has_waistcoat_option,
        suitOptions=json.loads(item.suit_options) if item.suit_options else None,
        brand=item.brand,
        isSoldOut=item.is_sold_out,
    )


@router.get("", response_model=list[ProductOut])
def list_products(db: Session = Depends(get_db)):
    return [_to_product_out(item) for item in db.query(Product).all()]


@router.post("", response_model=ProductOut)
def create_product(
    payload: ProductIn,
    _admin: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    exists = db.get(Product, payload.id)
    if exists:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Product id already exists")

    item = Product(
        id=payload.id,
        name=payload.name,
        description=payload.description,
        price=payload.price,
        category=payload.category,
        wear_type=payload.wearType,
        image=payload.image,
        available_modes=json.dumps(payload.availableModes),
        fabric=payload.fabric,
        colors=json.dumps(payload.colors),
        sizes=json.dumps(payload.sizes),
        featured=payload.featured,
        has_waistcoat_option=payload.hasWaistcoatOption,
        suit_options=json.dumps(payload.suitOptions) if payload.suitOptions else None,
        brand=payload.brand,
        is_sold_out=payload.isSoldOut,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return _to_product_out(item)


@router.put("/{product_id}", response_model=ProductOut)
def update_product(
    product_id: str,
    payload: ProductIn,
    _admin: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    item = db.get(Product, product_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    item.name = payload.name
    item.description = payload.description
    item.price = payload.price
    item.category = payload.category
    item.wear_type = payload.wearType
    item.image = payload.image
    item.available_modes = json.dumps(payload.availableModes)
    item.fabric = payload.fabric
    item.colors = json.dumps(payload.colors)
    item.sizes = json.dumps(payload.sizes)
    item.featured = payload.featured
    item.has_waistcoat_option = payload.hasWaistcoatOption
    item.suit_options = json.dumps(payload.suitOptions) if payload.suitOptions else None
    item.brand = payload.brand
    item.is_sold_out = payload.isSoldOut
    db.commit()
    db.refresh(item)
    return _to_product_out(item)


@router.delete("/{product_id}")
def delete_product(
    product_id: str,
    _admin: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    item = db.get(Product, product_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    db.delete(item)
    db.commit()
    return {"ok": True}


@router.patch("/{product_id}/sold-out", response_model=ProductOut)
def toggle_product_sold_out(
    product_id: str,
    _admin: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    item = db.get(Product, product_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    
    item.is_sold_out = not item.is_sold_out
    db.commit()
    db.refresh(item)
    return _to_product_out(item)

