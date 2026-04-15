from __future__ import annotations

from typing import Any, Dict, List, Optional
from typing import Literal

from pydantic import BaseModel, Field


class EmployeeInput(BaseModel):
    id: str
    is_backup: bool = False


class MachineInput(BaseModel):
    id: str
    max_employees: int = Field(ge=0)
    importance: Literal['MANDATORY', 'PRIORITY', 'OPTIONAL'] = 'OPTIONAL'
    open_time_slot_ids: List[str] = []
    downtime_dates: List[str] = []


class SkillInput(BaseModel):
    employee_id: str
    machine_id: str


class TimeSlotInput(BaseModel):
    id: str
    name: str
    short_name: Optional[str] = None
    color: Optional[str] = None


class UnavailableDayInput(BaseModel):
    employee_id: str
    day_date: str  # YYYY-MM-DD
    status_id: Optional[str] = None


class UnavailableShiftInput(BaseModel):
    employee_id: str
    day_date: str
    time_slot_id: str
    status_id: Optional[str] = None


class MachineClosedShiftInput(BaseModel):
    machine_id: str
    day_date: str
    time_slot_id: str


class MachineShiftMinRequirementInput(BaseModel):
    machine_id: str
    day_date: str
    time_slot_id: str
    min_employees: int = Field(default=0, ge=0)


class ExistingAssignmentInput(BaseModel):
    day_date: str  # YYYY-MM-DD
    employee_id: str
    machine_id: str
    time_slot_id: Optional[str] = None


class ConstraintsInput(BaseModel):
    # Objective weights
    fairness_weight: int = Field(default=1, ge=0)
    priority_machine_weight: int = Field(default=50, ge=0)
    stability_weight: int = Field(default=0, ge=0)

    # Solver behavior
    solve_time_limit_seconds: int = Field(default=30, ge=1, le=3600)
    relative_gap_limit: float = Field(default=0.02, ge=0.0, le=1.0)

    # If true, the solver must choose exactly one time slot whenever a
    # machine assignment is made for an employee and day.
    enforce_time_slot_when_assigned: bool = True


class SolveRequest(BaseModel):
    from_date: str  # YYYY-MM-DD
    to_date: str  # YYYY-MM-DD

    employees: List[EmployeeInput]
    machines: List[MachineInput]
    skills: List[SkillInput]
    time_slots: List[TimeSlotInput]

    # Each entry means the employee is unavailable on that day
    unavailable_days: List[UnavailableDayInput] = []
    unavailable_shifts: List[UnavailableShiftInput] = []
    machine_closed_shifts: List[MachineClosedShiftInput] = []
    machine_shift_min_requirements: List[MachineShiftMinRequirementInput] = []

    # Optional lock-in for already confirmed days
    existing_assignments: List[ExistingAssignmentInput] = []

    # Soft reference for re-planning: the solver will try to stay close to
    # these assignments but is free to deviate when necessary.
    reference_assignments: List[ExistingAssignmentInput] = []

    constraints: ConstraintsInput = Field(default_factory=ConstraintsInput)

    # Freeform metadata to support future rules and debugging
    meta: Dict[str, Any] = {}


class PlannedAssignment(BaseModel):
    day_date: str
    employee_id: str
    machine_id: str
    time_slot_id: str


class SolveResponse(BaseModel):
    ok: bool
    assignments: List[PlannedAssignment] = []
    stats: Dict[str, Any] = {}
    error: Optional[str] = None

