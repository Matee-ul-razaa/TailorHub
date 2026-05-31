"""Smart Measurement Estimator.

Given basic body inputs (height, weight, age, gender, build, fit preference)
this service produces a heuristic prediction of all garment-specific
measurements in **inches**.

This is intentionally NOT a deep-ML model. The estimates are based on
published anthropometric ratios (chest ~ 0.50 × height for adult males,
shoulder ~ 0.26 × height, etc.) blended with BMI and build adjustments.
The frontend uses these as starting values that the user can refine before
saving — preventing the "blank form paralysis" problem.

Confidence levels:
  - high   : adult, BMI 18.5-29.9, common build, height 60-78"
  - medium : edges of normal range
  - low    : extreme BMI, very young/old, missing optional inputs
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Optional


CM_PER_INCH = 2.54


class Gender(str, Enum):
    male = "male"
    female = "female"
    other = "other"


class Build(str, Enum):
    slim = "slim"
    average = "average"
    athletic = "athletic"
    heavyset = "heavyset"


class Fit(str, Enum):
    slim = "slim"
    regular = "regular"
    loose = "loose"


@dataclass
class EstimateInputs:
    garment_type: str
    height_cm: float
    weight_kg: float
    age_years: int = 30
    gender: Gender = Gender.male
    build: Build = Build.average
    fit: Fit = Fit.regular


@dataclass
class EstimateResult:
    data: dict[str, float]            # field_key -> inches (rounded to 0.5)
    confidence: str                    # "low" | "medium" | "high"
    notes: list[str]


# ── Per-garment field lists (mirror frontend GARMENT_FIELDS) ─────────────────
GARMENT_FIELDS: dict[str, list[str]] = {
    "shirt": ["chest", "shoulder", "sleeveLength", "shirtLength", "neck"],
    "shalwar-kameez": ["kameezLength", "chest", "shoulder", "sleeveLength", "shalwarLength", "waist"],
    "pant": ["waist", "hip", "inseam", "thigh", "pantLength"],
    "suit": ["chest", "shoulder", "sleeveLength", "jacketLength", "waist", "hip", "inseam"],
    "kurta-pajama": ["kurtaLength", "chest", "shoulder", "sleeveLength", "pajamaLength", "waist"],
}


# Build adjustments in inches added to chest/waist/hip baseline
_BUILD_ADJUST = {
    Build.slim: -2.0,
    Build.average: 0.0,
    Build.athletic: 1.0,
    Build.heavyset: 3.0,
}

# Fit adjustments to chest/waist/hip (looseness allowance)
_FIT_ADJUST = {
    Fit.slim: -1.0,
    Fit.regular: 0.0,
    Fit.loose: 2.0,
}


def _round_half(x: float) -> float:
    return round(x * 2) / 2


def _bmi(weight_kg: float, height_cm: float) -> float:
    h_m = max(0.5, height_cm / 100.0)
    return weight_kg / (h_m * h_m)


def _confidence(inp: EstimateInputs) -> tuple[str, list[str]]:
    notes: list[str] = []
    height_in = inp.height_cm / CM_PER_INCH
    bmi = _bmi(inp.weight_kg, inp.height_cm)

    edges = 0
    if not (60.0 <= height_in <= 78.0):
        edges += 1
        notes.append("Height is outside the typical adult range (60-78 in / 152-198 cm).")
    if not (18.5 <= bmi <= 29.9):
        edges += 1
        notes.append(f"BMI {bmi:.1f} is outside the typical 18.5-29.9 range.")
    if inp.age_years < 16 or inp.age_years > 75:
        edges += 1
        notes.append("Age is outside the typical adult range; growth/posture may shift values.")

    if edges == 0:
        return "high", notes
    if edges == 1:
        return "medium", notes
    return "low", notes


# ── Core estimation per field ────────────────────────────────────────────────

def _chest(height_in: float, weight_kg: float, gender: Gender) -> float:
    """Chest circumference in inches.

    Base: ~ 0.50 × height for adult males, 0.46 × height for adult females.
    Blended with weight: every 5 kg above ~70 kg adds ~0.6 in chest.
    """
    base_ratio = 0.50 if gender == Gender.male else 0.46
    base = base_ratio * height_in
    weight_offset = (max(0.0, weight_kg - 70.0) / 5.0) * 0.6
    weight_offset -= (max(0.0, 60.0 - weight_kg) / 5.0) * 0.6
    return base + weight_offset


def _waist(chest_in: float, gender: Gender, age_years: int) -> float:
    """Waist ~ chest - 6 in (male, age 30); shrinks slightly with younger age."""
    diff = 6.0 if gender == Gender.male else 8.0
    if age_years < 25:
        diff += 1.0
    if age_years > 50:
        diff -= 1.5
    return chest_in - diff


def _hip(waist_in: float, gender: Gender) -> float:
    return waist_in + (3.0 if gender == Gender.male else 5.0)


def _shoulder(height_in: float, gender: Gender) -> float:
    """Shoulder width ~ 0.26 × height (male), 0.24 × height (female)."""
    ratio = 0.26 if gender == Gender.male else 0.24
    return ratio * height_in


def _sleeve_length(height_in: float) -> float:
    """Full sleeve length (shoulder to wrist) ~ 0.345 × height."""
    return 0.345 * height_in


def _inseam(height_in: float) -> float:
    """Inseam ~ 0.45 × height."""
    return 0.45 * height_in


def _thigh(hip_in: float) -> float:
    return hip_in * 0.59


def _torso_length(height_in: float) -> float:
    """Nape-to-waist torso length ~ 0.27 × height."""
    return 0.27 * height_in


def _kameez_length(height_in: float, gender: Gender, fit: Fit) -> float:
    """Kameez/kurta typically falls mid-thigh.

    For male: ~ 0.41 × height; female: ~ 0.42 × height.
    Loose fits add ~1 inch.
    """
    base = (0.41 if gender == Gender.male else 0.42) * height_in
    if fit == Fit.loose:
        base += 1.0
    return base


def _shirt_length(height_in: float, gender: Gender) -> float:
    """Western shirt length (CB to hem) ~ 0.395 × height."""
    return (0.395 if gender == Gender.male else 0.38) * height_in


def _jacket_length(height_in: float, gender: Gender) -> float:
    return (0.41 if gender == Gender.male else 0.40) * height_in


def _shalwar_length(inseam_in: float) -> float:
    """Shalwar full length ~ inseam + 4 in (waistband + ankle break)."""
    return inseam_in + 4.0


def _pajama_length(inseam_in: float) -> float:
    return inseam_in + 3.5


def _pant_length(inseam_in: float) -> float:
    """Outseam (pant length) ~ inseam + ~9-10 in (rise)."""
    return inseam_in + 9.5


def _neck(chest_in: float, gender: Gender) -> float:
    """Neck circumference ~ chest × 0.38 (male), × 0.36 (female)."""
    ratio = 0.38 if gender == Gender.male else 0.36
    return chest_in * ratio


# ── Main entry point ─────────────────────────────────────────────────────────

def estimate(inp: EstimateInputs) -> EstimateResult:
    """Return predicted measurements for the requested garment."""
    fields = GARMENT_FIELDS.get(inp.garment_type)
    if not fields:
        raise ValueError(f"Unsupported garmentType: {inp.garment_type}")

    height_in = inp.height_cm / CM_PER_INCH

    # Core derived values
    chest = _chest(height_in, inp.weight_kg, inp.gender)
    chest += _BUILD_ADJUST[inp.build] + _FIT_ADJUST[inp.fit]

    waist = _waist(chest, inp.gender, inp.age_years)
    waist += _BUILD_ADJUST[inp.build] + _FIT_ADJUST[inp.fit]

    hip = _hip(waist, inp.gender)

    inseam = _inseam(height_in)

    field_to_value: dict[str, float] = {}
    for key in fields:
        if key == "chest":
            v = chest
        elif key == "waist":
            v = waist
        elif key == "hip":
            v = hip
        elif key == "shoulder":
            v = _shoulder(height_in, inp.gender)
        elif key == "sleeveLength":
            v = _sleeve_length(height_in)
        elif key == "inseam":
            v = inseam
        elif key == "thigh":
            v = _thigh(hip)
        elif key == "kameezLength" or key == "kurtaLength":
            v = _kameez_length(height_in, inp.gender, inp.fit)
        elif key == "shirtLength":
            v = _shirt_length(height_in, inp.gender)
        elif key == "jacketLength":
            v = _jacket_length(height_in, inp.gender)
        elif key == "shalwarLength":
            v = _shalwar_length(inseam)
        elif key == "pajamaLength":
            v = _pajama_length(inseam)
        elif key == "pantLength":
            v = _pant_length(inseam)
        elif key == "neck":
            v = _neck(chest, inp.gender)
        else:
            continue
        field_to_value[key] = _round_half(max(1.0, v))

    confidence, notes = _confidence(inp)
    if inp.fit == Fit.loose:
        notes.append("Loose fit selected: extra ease applied to chest/waist/hip.")
    if inp.build == Build.athletic:
        notes.append("Athletic build: shoulders/chest emphasised over waist.")
    notes.append("These are starting estimates — please verify with a tape measure before saving.")

    return EstimateResult(data=field_to_value, confidence=confidence, notes=notes)
