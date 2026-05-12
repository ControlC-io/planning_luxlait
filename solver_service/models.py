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
    # AUTONOMOUS = can work alone on the machine
    # IN_TRAINING = must be paired with an autonomous coworker on the same
    #               machine during the same shift (never solo)
    level: Literal['AUTONOMOUS', 'IN_TRAINING'] = 'AUTONOMOUS'


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
    # Bonus per F-only employee scheduled (someone whose every skill is
    # IN_TRAINING). They have nothing else to do, so we actively pair them
    # with an autonomous coworker for training.
    training_bonus_weight: int = Field(default=10, ge=0)
    # Bonus per F-partial employee (has both A and F skills) scheduled to one
    # of their AUTONOMOUS machines on a given day. Encourages productive work.
    polyvalent_in_autonomous_bonus_weight: int = Field(default=7, ge=0)
    # Bonus per F-partial employee scheduled to one of their IN_TRAINING
    # machines on a given day. Strictly lower than the AUTONOMOUS bonus so
    # the solver prefers placing them on productive work, but high enough to
    # justify a training shift when no autonomous slot is available.
    polyvalent_in_training_bonus_weight: int = Field(default=6, ge=0)
    # Penalty per employee assigned beyond the minimum staffing requirement on
    # a given (machine, day, shift). Discourages A+A doublons and unnecessary
    # F doublons.
    extra_coverage_penalty_weight: int = Field(default=5, ge=0)

    # Solver behavior
    solve_time_limit_seconds: int = Field(default=30, ge=1, le=3600)
    relative_gap_limit: float = Field(default=0.02, ge=0.0, le=1.0)

    # If true, the solver must choose exactly one time slot whenever a
    # machine assignment is made for an employee and day.
    enforce_time_slot_when_assigned: bool = True

    # Hard cap on the number of work days a single employee can be scheduled
    # for inside a given ISO calendar week (Monday to Sunday).
    # Locked assignments count toward this limit. Set to 0 to disable.
    # Default 6 matches Luxembourg labor code L. 231 3 (44h consecutive
    # weekly rest, equivalent to one full day off per week).
    max_work_days_per_week: int = Field(default=6, ge=0, le=7)

    # Legal floor on the number of off days in any ISO calendar week.
    # Code du travail luxembourgeois article L. 231 3 mandates a continuous
    # weekly rest of 44 hours, so at least one full day off per week.
    # Locked assignments are counted toward the cap. Set to 0 to disable.
    min_rest_days_per_week: int = Field(default=1, ge=0, le=7)

    # Maximum number of consecutive working days for a single employee.
    # Implements the spirit of L. 231 3 by guaranteeing at least one rest
    # day inside any rolling window of (max_consecutive_work_days + 1) days.
    # Locked assignments are counted. Set to 0 to disable.
    max_consecutive_work_days: int = Field(default=6, ge=0, le=14)


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

