import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .database import get_db
from .deps import get_current_user
from .models import Measurement, User
from .schemas import MeasurementIn, MeasurementOut, MeasurementUpdateIn
from .services.measurement_estimator import (
    Build,
    EstimateInputs,
    Fit,
    Gender,
    estimate,
)

router = APIRouter(prefix="/api/measurements", tags=["measurements"])


# ── Smart-suggest schemas ────────────────────────────────────────────────────

class SuggestIn(BaseModel):
    garmentType: str
    heightCm: float = Field(gt=80.0, lt=260.0, description="Height in cm")
    weightKg: float = Field(gt=20.0, lt=250.0, description="Weight in kg")
    ageYears: int = Field(default=30, ge=4, le=110)
    gender: Gender = Gender.male
    build: Build = Build.average
    fit: Fit = Fit.regular


class SuggestOut(BaseModel):
    garmentType: str
    data: dict[str, float]
    confidence: str
    notes: list[str]


def _to_out(m: Measurement) -> MeasurementOut:
    return MeasurementOut(
        id=m.id,
        uniqueCode=m.unique_code,
        garmentType=m.garment_type,
        label=m.label,
        data=json.loads(m.data_json),
        createdAt=m.created_at,
        updatedAt=m.updated_at,
    )


@router.get("", response_model=list[MeasurementOut])
def list_measurements(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(Measurement).filter(Measurement.user_id == user.id).order_by(Measurement.updated_at.desc()).all()
    return [_to_out(m) for m in rows]


@router.get("/lookup/{code}", response_model=MeasurementOut)
def lookup_measurement(code: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    m = db.query(Measurement).filter(Measurement.unique_code == code, Measurement.user_id == user.id).first()
    if not m:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Measurement not found")
    return _to_out(m)


@router.post("", response_model=MeasurementOut, status_code=status.HTTP_201_CREATED)
def create_measurement(payload: MeasurementIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    m = Measurement(
        user_id=user.id,
        garment_type=payload.garmentType,
        label=payload.label or f"{payload.garmentType.replace('-', ' ').title()} Measurements",
        data_json=json.dumps(payload.data),
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    return _to_out(m)


@router.put("/{measurement_id}", response_model=MeasurementOut)
def update_measurement(measurement_id: int, payload: MeasurementUpdateIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    m = db.query(Measurement).filter(Measurement.id == measurement_id, Measurement.user_id == user.id).first()
    if not m:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Measurement not found")
    if payload.label is not None:
        m.label = payload.label
    if payload.data is not None:
        m.data_json = json.dumps(payload.data)
    db.commit()
    db.refresh(m)
    return _to_out(m)


@router.delete("/{measurement_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_measurement(measurement_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    m = db.query(Measurement).filter(Measurement.id == measurement_id, Measurement.user_id == user.id).first()
    if not m:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Measurement not found")
    db.delete(m)
    db.commit()


@router.post("/suggest", response_model=SuggestOut)
def suggest_measurements(payload: SuggestIn, _user: User = Depends(get_current_user)):
    """Heuristic Smart Measurement Estimator.

    Given basic body inputs, returns a set of starting measurement values for
    the chosen garment. The frontend can pre-fill the measurement form so the
    user only has to refine values rather than start from blank.
    """
    try:
        result = estimate(
            EstimateInputs(
                garment_type=payload.garmentType,
                height_cm=payload.heightCm,
                weight_kg=payload.weightKg,
                age_years=payload.ageYears,
                gender=payload.gender,
                build=payload.build,
                fit=payload.fit,
            )
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return SuggestOut(
        garmentType=payload.garmentType,
        data=result.data,
        confidence=result.confidence,
        notes=result.notes,
    )
