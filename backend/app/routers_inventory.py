from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from .database import get_db
from .deps import require_role
from .models import InventoryItem, UserRole
from .schemas import InventoryItemIn, InventoryItemOut

router = APIRouter(prefix="/api/inventory", tags=["inventory"])

@router.get("", response_model=List[InventoryItemOut])
def list_inventory(
    _admin: Session = Depends(require_role(UserRole.admin)), 
    db: Session = Depends(get_db)
):
    return db.query(InventoryItem).all()

@router.post("", response_model=InventoryItemOut, status_code=status.HTTP_201_CREATED)
def add_inventory_item(
    payload: InventoryItemIn,
    _admin: Session = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db)
):
    item = InventoryItem(
        name=payload.name,
        quantity=payload.quantity,
        unit=payload.unit,
        price_per_unit=payload.price_per_unit,
        threshold=payload.threshold
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

@router.patch("/{item_id}/deduct", response_model=InventoryItemOut)
def deduct_stock(
    item_id: int,
    amount: float,
    _admin: Session = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db)
):
    item = db.get(InventoryItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    if item.quantity < amount:
        raise HTTPException(status_code=400, detail="Not enough stock available")
        
    item.quantity -= amount
    db.commit()
    db.refresh(item)
    return item


@router.patch("/{item_id}/sold-out", response_model=InventoryItemOut)
def toggle_sold_out(
    item_id: int,
    _admin: Session = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db)
):
    """Toggle the is_sold_out flag for an inventory item (admin only)."""
    item = db.get(InventoryItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    item.is_sold_out = not item.is_sold_out
    db.commit()
    db.refresh(item)
    return item

@router.get("/alerts", response_model=List[InventoryItemOut])
def get_low_stock_alerts(
    _admin: Session = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db)
):
    return db.query(InventoryItem).filter(InventoryItem.quantity <= InventoryItem.threshold).all()
