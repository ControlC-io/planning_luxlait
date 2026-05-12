from __future__ import annotations

import datetime as dt
import time
from collections import defaultdict
from typing import Dict, List, Optional, Sequence, Set, Tuple

from ortools.sat.python import cp_model

from .models import (
    ConstraintsInput,
    EmployeeInput,
    ExistingAssignmentInput,
    MachineInput,
    PlannedAssignment,
    SkillInput,
    SolveRequest,
    SolveResponse,
    TimeSlotInput,
    UnavailableDayInput,
)


def _parse_date_yyyy_mm_dd(value: str) -> dt.date:
    return dt.datetime.strptime(value, "%Y-%m-%d").date()


def _daterange_inclusive(start: dt.date, end: dt.date) -> List[dt.date]:
    if end < start:
        return []
    days: List[dt.date] = []
    cur = start
    while cur <= end:
        days.append(cur)
        cur += dt.timedelta(days=1)
    return days


def _lower_or_empty(s: Optional[str]) -> str:
    return (s or "").strip().lower()


# Number of slots that must elapse between two shifts of the same
# employee. With 8h shifts, the next 2 slots after a worked one are
# forbidden, which guarantees a 16h rest before the next shift.
REST_GAP_SLOTS: int = 2


def _infer_working_time_slots(time_slots: Sequence[TimeSlotInput]) -> List[TimeSlotInput]:
    return [
        ts
        for ts in time_slots
        if "repos" not in _lower_or_empty(ts.name)
        and "repos" not in _lower_or_empty(ts.short_name)
    ]


def solve_cp_sat(req: SolveRequest) -> SolveResponse:
    start = time.time()

    try:
        from_date = _parse_date_yyyy_mm_dd(req.from_date)
        to_date = _parse_date_yyyy_mm_dd(req.to_date)
        days = _daterange_inclusive(from_date, to_date)

        employees = req.employees
        machines = req.machines
        time_slots = req.time_slots

        if not employees or not machines or not days:
            return SolveResponse(ok=True, assignments=[], stats={"durationMs": int((time.time() - start) * 1000)})

        working_time_slots_ordered = sorted(
            _infer_working_time_slots(time_slots), key=lambda ts: ts.sort_order
        )
        if not working_time_slots_ordered:
            working_time_slots_ordered = sorted(
                list(time_slots), key=lambda ts: ts.sort_order
            )

        working_time_slot_ids = [ts.id for ts in working_time_slots_ordered]
        working_time_slot_set = set(working_time_slot_ids)
        num_working_slots = len(working_time_slot_ids)

        employee_ids = [e.id for e in employees]
        machine_ids = [m.id for m in machines]
        employee_id_set = set(employee_ids)
        machine_id_set = set(machine_ids)
        days_set = set(days)

        emp_by_id = {e.id: e for e in employees}
        machine_by_id = {m.id: m for m in machines}

        machine_downtime_by_machine_id: Dict[str, Set[dt.date]] = {
            m.id: {
                _parse_date_yyyy_mm_dd(d)
                for d in (m.downtime_dates or [])
                if isinstance(d, str) and d.strip()
            }
            for m in machines
        }
        machine_open_time_slots_by_machine_id: Dict[str, Set[str]] = {
            m.id: set(m.open_time_slot_ids or []) for m in machines
        }

        unavailable: Set[Tuple[str, dt.date]] = set()
        for u in req.unavailable_days:
            u_day = _parse_date_yyyy_mm_dd(u.day_date)
            unavailable.add((u.employee_id, u_day))
        unavailable_shift: Set[Tuple[str, dt.date, str]] = set()
        for u in req.unavailable_shifts:
            u_day = _parse_date_yyyy_mm_dd(u.day_date)
            unavailable_shift.add((u.employee_id, u_day, u.time_slot_id))

        machine_closed_shift: Set[Tuple[str, dt.date, str]] = set()
        for row in req.machine_closed_shifts:
            c_day = _parse_date_yyyy_mm_dd(row.day_date)
            machine_closed_shift.add((row.machine_id, c_day, row.time_slot_id))

        machine_shift_min_requirements: Dict[Tuple[str, dt.date, str], int] = defaultdict(int)
        for row in req.machine_shift_min_requirements:
            r_day = _parse_date_yyyy_mm_dd(row.day_date)
            machine_shift_min_requirements[(row.machine_id, r_day, row.time_slot_id)] = int(row.min_employees)

        qualified_for_machine: Dict[str, Set[str]] = {m_id: set() for m_id in machine_ids}
        autonomous_for_machine: Dict[str, Set[str]] = {m_id: set() for m_id in machine_ids}
        in_training_for_machine: Dict[str, Set[str]] = {m_id: set() for m_id in machine_ids}
        for sk in req.skills:
            if sk.machine_id not in qualified_for_machine:
                continue
            qualified_for_machine[sk.machine_id].add(sk.employee_id)
            if sk.level == 'IN_TRAINING':
                in_training_for_machine[sk.machine_id].add(sk.employee_id)
            else:
                autonomous_for_machine[sk.machine_id].add(sk.employee_id)

        # ── Handle existing (locked-in) assignments ──────────────────────────
        # Locked-in pairs are excluded from the solver entirely. Their capacity
        # is pre-subtracted from the machine limits.
        locked: Dict[Tuple[str, dt.date], ExistingAssignmentInput] = {}
        for a in req.existing_assignments:
            ad = _parse_date_yyyy_mm_dd(a.day_date)
            if a.employee_id in employee_id_set and ad in days_set and a.machine_id in machine_id_set:
                locked[(a.employee_id, ad)] = a

        locked_emp_days: Set[Tuple[str, dt.date]] = set(locked.keys())

        # Locked assignments represent the user's accepted plan. Skip
        # validation so pre-existing inconsistencies do not block re-plans.

        # Count how many locked-in employees sit on each (machine, day).
        locked_capacity_used: Dict[Tuple[str, dt.date], int] = defaultdict(int)
        for (_, d), a in locked.items():
            locked_capacity_used[(a.machine_id, d)] += 1

        # Track the slot id of locked assignments so the rest constraint
        # can forbid the corresponding successor slots on the next day.
        locked_slot_id_by_emp_day: Dict[Tuple[str, dt.date], str] = {}
        for (e_id, d), a in locked.items():
            if a.time_slot_id and a.time_slot_id in working_time_slot_set:
                locked_slot_id_by_emp_day[(e_id, d)] = a.time_slot_id

        # ── Build CP-SAT model ───────────────────────────────────────────────
        model = cp_model.CpModel()

        x: Dict[Tuple[str, dt.date, str], cp_model.IntVar] = {}
        assigned_any: Dict[Tuple[str, dt.date], cp_model.IntVar] = {}
        t: Dict[Tuple[str, dt.date, str], cp_model.IntVar] = {}

        machines_for_employee: Dict[str, Set[str]] = {e_id: set() for e_id in employee_ids}
        for m_id, emp_set in qualified_for_machine.items():
            for e_id in emp_set:
                if e_id in machines_for_employee:
                    machines_for_employee[e_id].add(m_id)

        for e_id in employee_ids:
            for d in days:
                if (e_id, d) in locked_emp_days:
                    continue
                if (e_id, d) in unavailable:
                    continue

                eligible = [
                    m_id for m_id in machines_for_employee[e_id]
                    if d not in machine_downtime_by_machine_id.get(m_id, set())
                ]
                if not eligible:
                    continue

                assigned = model.new_bool_var(f"assigned_e{e_id}_d{d.isoformat()}")
                assigned_any[(e_id, d)] = assigned

                for m_id in eligible:
                    x[(e_id, d, m_id)] = model.new_bool_var(f"x_e{e_id}_d{d.isoformat()}_m{m_id}")

                model.add(sum(x[(e_id, d, m_id)] for m_id in eligible) == assigned)

                for ts_id in working_time_slot_ids:
                    t[(e_id, d, ts_id)] = model.new_bool_var(f"t_e{e_id}_d{d.isoformat()}_ts{ts_id}")

                if req.constraints.enforce_time_slot_when_assigned:
                    model.add(sum(t[(e_id, d, ts_id)] for ts_id in working_time_slot_ids) == assigned)
                else:
                    model.add(sum(t[(e_id, d, ts_id)] for ts_id in working_time_slot_ids) <= assigned)

        # ── Hard caps inspired by Luxembourg Code du travail ────────────────
        # Locked assignments count toward every cap. Setting any limit to 0
        # disables that specific rule.
        max_work_days_per_week = int(req.constraints.max_work_days_per_week)
        min_rest_days_per_week = int(req.constraints.min_rest_days_per_week)
        max_consecutive_work_days = int(req.constraints.max_consecutive_work_days)

        # Group planning days by ISO calendar week (Mon to Sun).
        days_by_iso_week: Dict[Tuple[int, int], List[dt.date]] = defaultdict(list)
        for d in days:
            iso_year, iso_week, _ = d.isocalendar()
            days_by_iso_week[(iso_year, iso_week)].append(d)

        if max_work_days_per_week > 0 or min_rest_days_per_week > 0:
            for e_id in employee_ids:
                for _week_key, week_days in days_by_iso_week.items():
                    locked_count_in_week = sum(
                        1 for d in week_days if (e_id, d) in locked_emp_days
                    )
                    solver_lits = [
                        assigned_any[(e_id, d)]
                        for d in week_days
                        if (e_id, d) in assigned_any
                    ]

                    week_caps: List[int] = []
                    if max_work_days_per_week > 0:
                        week_caps.append(max_work_days_per_week)
                    if min_rest_days_per_week > 0:
                        # Cap derived from the legal floor of off days.
                        # Apply only inside the planning window of this
                        # week so partial weeks are not forced to extra off
                        # days they cannot take.
                        week_caps.append(max(0, len(week_days) - min_rest_days_per_week))

                    if not week_caps:
                        continue

                    effective_cap = min(week_caps)
                    remaining = effective_cap - locked_count_in_week
                    if remaining <= 0:
                        # Locked plan already saturates the cap. Force every
                        # solver decided day off. We do not error out: locked
                        # rows are accepted by the user and may pre-violate
                        # the cap.
                        for lit in solver_lits:
                            model.add(lit == 0)
                        continue

                    if solver_lits:
                        model.add(sum(solver_lits) <= remaining)

        if max_consecutive_work_days > 0 and len(days) > max_consecutive_work_days:
            window_size = max_consecutive_work_days + 1
            for e_id in employee_ids:
                for start in range(len(days) - max_consecutive_work_days):
                    window = days[start : start + window_size]
                    locked_in_window = sum(
                        1 for d in window if (e_id, d) in locked_emp_days
                    )
                    solver_lits_window = [
                        assigned_any[(e_id, d)]
                        for d in window
                        if (e_id, d) in assigned_any
                    ]

                    remaining = max_consecutive_work_days - locked_in_window
                    if remaining <= 0:
                        for lit in solver_lits_window:
                            model.add(lit == 0)
                        continue

                    if solver_lits_window:
                        model.add(sum(solver_lits_window) <= remaining)

        # ── Shared overlap cache: ov[(e,d,m,ts)] = x[(e,d,m)] AND t[(e,d,ts)] ─
        overlap_cache: Dict[Tuple[str, dt.date, str, str], cp_model.IntVar] = {}

        def get_overlap(e_id: str, d: dt.date, m_id: str, ts_id: str) -> cp_model.IntVar:
            key = (e_id, d, m_id, ts_id)
            if key not in overlap_cache:
                v = model.new_bool_var(f"ov_e{e_id}_m{m_id}_d{d.isoformat()}_ts{ts_id}")
                model.add(v <= x[(e_id, d, m_id)])
                model.add(v <= t[(e_id, d, ts_id)])
                model.add(v >= x[(e_id, d, m_id)] + t[(e_id, d, ts_id)] - 1)
                overlap_cache[key] = v
            return overlap_cache[key]

        # ── Open shift constraint: restrict machines by time slot ─────────
        for m_id in machine_ids:
            open_slots = machine_open_time_slots_by_machine_id.get(m_id, set())
            if not open_slots:
                continue

            for e_id in employee_ids:
                for d in days:
                    if (e_id, d, m_id) not in x:
                        continue

                    compatible_lits = []
                    for ts_id in open_slots:
                        if (e_id, d, ts_id) not in t:
                            continue
                        if (e_id, d, ts_id) in unavailable_shift:
                            continue
                        if (m_id, d, ts_id) in machine_closed_shift:
                            continue
                        compatible_lits.append(t[(e_id, d, ts_id)])
                    if compatible_lits:
                        # If the employee is assigned to this machine, the time slot must be compatible.
                        model.add(x[(e_id, d, m_id)] <= sum(compatible_lits))
                    else:
                        model.add(x[(e_id, d, m_id)] == 0)

        locked_shift_coverage: Dict[Tuple[str, dt.date, str], int] = defaultdict(int)
        for (_, d), a in locked.items():
            if a.time_slot_id:
                locked_shift_coverage[(a.machine_id, d, a.time_slot_id)] += 1

        priority_shift_covered_vars: List[cp_model.IntVar] = []

        # Mandatory open shift coverage is a hard constraint.
        # Priority open shift coverage is a soft objective.
        for m_id in machine_ids:
            m = machine_by_id[m_id]
            open_slots = machine_open_time_slots_by_machine_id.get(m_id, set())
            if not open_slots:
                continue

            downtime_set = machine_downtime_by_machine_id.get(m_id, set())
            qualified_in_scope = qualified_for_machine.get(m_id, set())

            for d in days:
                if d in downtime_set:
                    continue

                for ts_id in open_slots:
                    if (m_id, d, ts_id) in machine_closed_shift:
                        # Closed shifts must not require coverage, even for mandatory machines.
                        continue
                    if ts_id not in working_time_slot_set:
                        if m.importance == "MANDATORY":
                            return SolveResponse(
                                ok=False,
                                assignments=[],
                                stats={
                                    "durationMs": int((time.time() - start) * 1000),
                                    "error": "Mandatory open shift outside working set",
                                },
                                error=(
                                    f"Mandatory machine {m_id} requires time slot {ts_id} on {d.isoformat()}, "
                                    "but this time slot is not available for planning"
                                ),
                            )
                        continue

                    if locked_shift_coverage.get((m_id, d, ts_id), 0) > 0:
                        if m.importance == "PRIORITY":
                            covered_by_locked = model.new_bool_var(
                                f"covered_priority_m{m_id}_d{d.isoformat()}_ts{ts_id}_locked"
                            )
                            model.add(covered_by_locked == 1)
                            priority_shift_covered_vars.append(covered_by_locked)
                        continue

                    candidate_overlap_lits: List[cp_model.IntVar] = []
                    for e_id in employee_ids:
                        if e_id not in qualified_in_scope:
                            continue
                        if (e_id, d) in locked_emp_days:
                            continue
                        if (e_id, d) in unavailable:
                            continue
                        if (e_id, d, m_id) not in x or (e_id, d, ts_id) not in t:
                            continue
                        if (e_id, d, ts_id) in unavailable_shift:
                            continue
                        if (m_id, d, ts_id) in machine_closed_shift:
                            continue

                        candidate_overlap_lits.append(get_overlap(e_id, d, m_id, ts_id))

                    if not candidate_overlap_lits:
                        if m.importance == "MANDATORY":
                            return SolveResponse(
                                ok=False,
                                assignments=[],
                                stats={
                                    "durationMs": int((time.time() - start) * 1000),
                                    "error": "Mandatory open shift has no feasible employee",
                                },
                                error=(
                                    f"Mandatory machine {m_id} has no feasible employee for "
                                    f"time slot {ts_id} on {d.isoformat()}"
                                ),
                            )

                        if m.importance == "PRIORITY":
                            not_covered = model.new_bool_var(
                                f"covered_priority_m{m_id}_d{d.isoformat()}_ts{ts_id}_none"
                            )
                            model.add(not_covered == 0)
                            priority_shift_covered_vars.append(not_covered)
                        continue

                    shift_covered = model.new_bool_var(
                        f"covered_m{m_id}_d{d.isoformat()}_ts{ts_id}"
                    )
                    model.add(sum(candidate_overlap_lits) >= 1).only_enforce_if(shift_covered)
                    model.add(sum(candidate_overlap_lits) == 0).only_enforce_if(shift_covered.Not())

                    if m.importance == "MANDATORY":
                        model.add(shift_covered == 1)
                    elif m.importance == "PRIORITY":
                        priority_shift_covered_vars.append(shift_covered)

        # Qualification is enforced by pre-filtering: x[(e,d,m)] only exists
        # when the employee is qualified for the machine, so no extra
        # constraints are needed here.

        # Enforce max capacity per machine per shift.
        for m_id in machine_ids:
            m = machine_by_id[m_id]
            base_max = int(m.max_employees)
            if base_max <= 0:
                continue
            downtime_set = machine_downtime_by_machine_id.get(m_id, set())
            for d in days:
                if d in downtime_set:
                    continue
                for ts_id in working_time_slot_ids:
                    if (m_id, d, ts_id) in machine_closed_shift:
                        continue
                    cap_overlaps: List[cp_model.IntVar] = []
                    for e_id in employee_ids:
                        if (e_id, d) in locked_emp_days:
                            continue
                        if (e_id, d, m_id) not in x or (e_id, d, ts_id) not in t:
                            continue
                        cap_overlaps.append(get_overlap(e_id, d, m_id, ts_id))
                    if cap_overlaps:
                        locked_on_shift = locked_shift_coverage.get((m_id, d, ts_id), 0)
                        remaining = max(0, base_max - locked_on_shift)
                        model.add(sum(cap_overlaps) <= remaining)

        # ── "In training never solo" constraint ─────────────────────────────
        # An employee with skill level IN_TRAINING must never be the only
        # operator on a given machine + day + shift. There must be at least one
        # AUTONOMOUS coworker (locked or solver assigned) on the same shift.
        for m_id in machine_ids:
            in_training_set = in_training_for_machine.get(m_id, set())
            if not in_training_set:
                continue
            autonomous_set = autonomous_for_machine.get(m_id, set())
            downtime_set = machine_downtime_by_machine_id.get(m_id, set())

            for d in days:
                if d in downtime_set:
                    continue

                for ts_id in working_time_slot_ids:
                    if (m_id, d, ts_id) in machine_closed_shift:
                        continue

                    in_training_overlaps: List[cp_model.IntVar] = []
                    for e_id in in_training_set:
                        if (e_id, d) in locked_emp_days:
                            continue
                        if (e_id, d) in unavailable:
                            continue
                        if (e_id, d, m_id) not in x or (e_id, d, ts_id) not in t:
                            continue
                        if (e_id, d, ts_id) in unavailable_shift:
                            continue
                        in_training_overlaps.append(get_overlap(e_id, d, m_id, ts_id))

                    if not in_training_overlaps:
                        continue

                    autonomous_overlaps: List[cp_model.IntVar] = []
                    for e_id in autonomous_set:
                        if (e_id, d) in locked_emp_days:
                            continue
                        if (e_id, d) in unavailable:
                            continue
                        if (e_id, d, m_id) not in x or (e_id, d, ts_id) not in t:
                            continue
                        if (e_id, d, ts_id) in unavailable_shift:
                            continue
                        autonomous_overlaps.append(get_overlap(e_id, d, m_id, ts_id))

                    locked_autonomous_count = 0
                    for (e_id, ld), a in locked.items():
                        if ld != d or a.machine_id != m_id or a.time_slot_id != ts_id:
                            continue
                        if e_id in autonomous_set:
                            locked_autonomous_count += 1

                    if not autonomous_overlaps and locked_autonomous_count == 0:
                        # No possible AUTONOMOUS partner on this shift → forbid
                        # any IN_TRAINING assignment on it.
                        for ov_f in in_training_overlaps:
                            model.add(ov_f == 0)
                        continue

                    autonomous_sum = sum(autonomous_overlaps) + locked_autonomous_count
                    for ov_f in in_training_overlaps:
                        model.add(ov_f <= autonomous_sum)

        # Enforce minimum staffing by machine/day/shift.
        for (m_id, d, ts_id), required_count in machine_shift_min_requirements.items():
            if required_count <= 0:
                continue
            if m_id not in machine_id_set or d not in days_set:
                continue
            open_slots = machine_open_time_slots_by_machine_id.get(m_id, set())
            if open_slots and ts_id not in open_slots:
                return SolveResponse(
                    ok=False,
                    assignments=[],
                    stats={"durationMs": int((time.time() - start) * 1000), "error": "Min staffing on closed open-shift"},
                    error=f"Min staffing requires machine {m_id} on {d.isoformat()} and time slot {ts_id}, but this slot is not open for the machine",
                )
            if (m_id, d, ts_id) in machine_closed_shift:
                return SolveResponse(
                    ok=False,
                    assignments=[],
                    stats={"durationMs": int((time.time() - start) * 1000), "error": "Min staffing on machine closed shift"},
                    error=f"Min staffing requires machine {m_id} on {d.isoformat()} and time slot {ts_id}, but this shift is closed",
                )
            if d in machine_downtime_by_machine_id.get(m_id, set()):
                return SolveResponse(
                    ok=False,
                    assignments=[],
                    stats={"durationMs": int((time.time() - start) * 1000), "error": "Min staffing on downtime day"},
                    error=f"Min staffing requires machine {m_id} on {d.isoformat()}, but machine is down on this day",
                )

            overlaps: List[cp_model.IntVar] = []
            locked_count = locked_shift_coverage.get((m_id, d, ts_id), 0)
            for e_id in employee_ids:
                if e_id not in qualified_for_machine.get(m_id, set()):
                    continue
                if (e_id, d) in locked_emp_days:
                    continue
                if (e_id, d, m_id) not in x or (e_id, d, ts_id) not in t:
                    continue
                if (e_id, d, ts_id) in unavailable_shift or (e_id, d) in unavailable:
                    continue
                overlaps.append(get_overlap(e_id, d, m_id, ts_id))

            if not overlaps and locked_count < required_count:
                return SolveResponse(
                    ok=False,
                    assignments=[],
                    stats={"durationMs": int((time.time() - start) * 1000), "error": "Insufficient workforce for minimum staffing"},
                    error=f"Not enough feasible employees for machine {m_id} on {d.isoformat()} and time slot {ts_id}",
                )

            model.add(sum(overlaps) + locked_count >= required_count)

        # Rest constraint: each working slot lasts 8h. After shift X the
        # next REST_GAP_SLOTS slots in the daily sequence (sorted by
        # sort_order) are forbidden, which guarantees a 16h rest before
        # the next shift can start. Same day successors are already
        # excluded by the single shift per day rule, so we only build
        # cross day forbidden pairs here.
        if num_working_slots >= 1:
            slot_position_by_id: Dict[str, int] = {
                ts_id: idx for idx, ts_id in enumerate(working_time_slot_ids)
            }

            forbidden_successor_pairs: List[Tuple[int, int, int]] = []
            for i in range(num_working_slots):
                for gap in range(1, REST_GAP_SLOTS + 1):
                    target = i + gap
                    day_offset = target // num_working_slots
                    if day_offset == 0:
                        continue
                    next_i = target % num_working_slots
                    forbidden_successor_pairs.append((i, day_offset, next_i))

            for e_id in employee_ids:
                for idx, d0 in enumerate(days):
                    for curr_i, day_offset, next_i in forbidden_successor_pairs:
                        d1_idx = idx + day_offset
                        if d1_idx >= len(days):
                            continue
                        d1 = days[d1_idx]

                        ts_curr = working_time_slot_ids[curr_i]
                        ts_next = working_time_slot_ids[next_i]

                        d0_locked = (e_id, d0) in locked_emp_days
                        d1_locked = (e_id, d1) in locked_emp_days

                        if d0_locked and d1_locked:
                            continue

                        if d0_locked:
                            if locked_slot_id_by_emp_day.get((e_id, d0)) != ts_curr:
                                continue
                            next_lit = t.get((e_id, d1, ts_next))
                            if next_lit is not None:
                                model.add(next_lit == 0)
                            continue

                        if d1_locked:
                            if locked_slot_id_by_emp_day.get((e_id, d1)) != ts_next:
                                continue
                            curr_lit = t.get((e_id, d0, ts_curr))
                            if curr_lit is not None:
                                model.add(curr_lit == 0)
                            continue

                        curr_lit = t.get((e_id, d0, ts_curr))
                        next_lit = t.get((e_id, d1, ts_next))
                        if curr_lit is None or next_lit is None:
                            continue

                        model.add(curr_lit + next_lit <= 1)

        # ── Stability objective (re-plan): prefer keeping reference assignments ─
        stability_keep_vars: List[cp_model.IntVar] = []
        if req.reference_assignments and req.constraints.stability_weight > 0:
            ref_by_emp_day: Dict[Tuple[str, dt.date], ExistingAssignmentInput] = {}
            for ra in req.reference_assignments:
                rd = _parse_date_yyyy_mm_dd(ra.day_date)
                if ra.employee_id in employee_id_set and rd in days_set:
                    ref_by_emp_day[(ra.employee_id, rd)] = ra

            for (e_id, d), ra in ref_by_emp_day.items():
                if (e_id, d) in locked_emp_days:
                    continue
                if (e_id, d) in unavailable:
                    continue

                if (e_id, d, ra.machine_id) in x:
                    keep_m = model.new_bool_var(f"keep_m_e{e_id}_d{d.isoformat()}")
                    model.add(keep_m == x[(e_id, d, ra.machine_id)])
                    stability_keep_vars.append(keep_m)

                if ra.time_slot_id and (e_id, d, ra.time_slot_id) in t:
                    keep_ts = model.new_bool_var(f"keep_ts_e{e_id}_d{d.isoformat()}")
                    model.add(keep_ts == t[(e_id, d, ra.time_slot_id)])
                    stability_keep_vars.append(keep_ts)

        # ── Solution hints from reference assignments (warm start) ─────────
        if req.reference_assignments:
            ref_hint_by_emp_day: Dict[Tuple[str, dt.date], ExistingAssignmentInput] = {}
            for ra in req.reference_assignments:
                rd = _parse_date_yyyy_mm_dd(ra.day_date)
                if ra.employee_id in employee_id_set and rd in days_set:
                    ref_hint_by_emp_day[(ra.employee_id, rd)] = ra

            for (e_id, d), ra in ref_hint_by_emp_day.items():
                if (e_id, d) in locked_emp_days:
                    continue
                if (e_id, d) in unavailable:
                    continue

                if (e_id, d) in assigned_any:
                    model.add_hint(assigned_any[(e_id, d)], 1)

                for m_id in machine_ids:
                    if (e_id, d, m_id) in x:
                        model.add_hint(x[(e_id, d, m_id)], 1 if m_id == ra.machine_id else 0)

                for ts_id in working_time_slot_ids:
                    if (e_id, d, ts_id) in t:
                        model.add_hint(
                            t[(e_id, d, ts_id)],
                            1 if ts_id == ra.time_slot_id else 0,
                        )

        # ── Fairness objective ───────────────────────────────────────────────
        totals: Dict[str, cp_model.IntVar] = {}
        for e_id in employee_ids:
            locked_count = sum(1 for d in days if (e_id, d) in locked_emp_days)
            solver_days = [d for d in days if (e_id, d) in assigned_any]

            if solver_days:
                total_e = model.new_int_var(locked_count, len(days), f"total_e{e_id}")
                model.add(total_e == locked_count + sum(assigned_any[(e_id, d)] for d in solver_days))
            else:
                total_e = model.new_int_var(locked_count, locked_count, f"total_e{e_id}")

            totals[e_id] = total_e

        min_shifts = model.new_int_var(0, len(days), "min_shifts")
        max_shifts = model.new_int_var(0, len(days), "max_shifts")
        for e_id in employee_ids:
            model.add(min_shifts <= totals[e_id])
            model.add(max_shifts >= totals[e_id])

        fairness_cost = model.new_int_var(0, len(days), "fairness_cost")
        model.add(fairness_cost == max_shifts - min_shifts)

        fairness_weight = req.constraints.fairness_weight
        priority_weight = req.constraints.priority_machine_weight
        stability_weight = req.constraints.stability_weight
        training_weight = req.constraints.training_bonus_weight
        polyvalent_a_weight = req.constraints.polyvalent_in_autonomous_bonus_weight
        polyvalent_f_weight = req.constraints.polyvalent_in_training_bonus_weight
        extra_coverage_weight = req.constraints.extra_coverage_penalty_weight

        priority_shift_covered_sum = (
            sum(priority_shift_covered_vars) if priority_shift_covered_vars else 0
        )
        stability_bonus = sum(stability_keep_vars) if stability_keep_vars else 0

        # Categorize employees by skill profile.
        employees_with_autonomous_skill: Set[str] = set()
        for emp_set in autonomous_for_machine.values():
            employees_with_autonomous_skill.update(emp_set)
        employees_with_in_training_skill: Set[str] = set()
        for emp_set in in_training_for_machine.values():
            employees_with_in_training_skill.update(emp_set)

        # F-only: every skill is IN_TRAINING. They have nothing else to do.
        in_training_only_employees: Set[str] = (
            employees_with_in_training_skill - employees_with_autonomous_skill
        )
        # F-partial: have both A and F skills. They are polyvalent.
        polyvalent_employees: Set[str] = (
            employees_with_in_training_skill & employees_with_autonomous_skill
        )

        # Per-employee, per-day map of their A and F qualified machines (so we
        # can build work_a and work_f indicator variables for polyvalents).
        autonomous_machines_for_employee: Dict[str, List[str]] = {
            e_id: [m_id for m_id in machine_ids if e_id in autonomous_for_machine.get(m_id, set())]
            for e_id in polyvalent_employees
        }
        in_training_machines_for_employee: Dict[str, List[str]] = {
            e_id: [m_id for m_id in machine_ids if e_id in in_training_for_machine.get(m_id, set())]
            for e_id in polyvalent_employees
        }

        # Bonus 1: F-only employees scheduled (any machine, any day).
        training_bonus_lits: List[cp_model.IntVar] = []
        for (e_id, d), assigned_var in assigned_any.items():
            if e_id in in_training_only_employees:
                training_bonus_lits.append(assigned_var)
        training_bonus = sum(training_bonus_lits) if training_bonus_lits else 0

        # Bonus 2 & 3: polyvalent employees scheduled, split by skill level
        # of the assigned machine. Bonus on autonomous > bonus on training so
        # the solver prefers placing them on productive work; but the F bonus
        # is non zero so they still go to training if no A slot is available.
        polyvalent_a_bonus_lits: List[cp_model.IntVar] = []
        polyvalent_f_bonus_lits: List[cp_model.IntVar] = []
        for e_id in polyvalent_employees:
            for d in days:
                if (e_id, d) not in assigned_any:
                    continue

                a_overlaps_today = [
                    x[(e_id, d, m_id)]
                    for m_id in autonomous_machines_for_employee.get(e_id, [])
                    if (e_id, d, m_id) in x
                ]
                if a_overlaps_today:
                    work_a = model.new_bool_var(
                        f"work_a_e{e_id}_d{d.isoformat()}"
                    )
                    # An employee can be assigned to at most one machine per
                    # day (assigned_any is binary), so the sum is 0 or 1.
                    model.add(sum(a_overlaps_today) == work_a)
                    polyvalent_a_bonus_lits.append(work_a)

                f_overlaps_today = [
                    x[(e_id, d, m_id)]
                    for m_id in in_training_machines_for_employee.get(e_id, [])
                    if (e_id, d, m_id) in x
                ]
                if f_overlaps_today:
                    work_f = model.new_bool_var(
                        f"work_f_e{e_id}_d{d.isoformat()}"
                    )
                    model.add(sum(f_overlaps_today) == work_f)
                    polyvalent_f_bonus_lits.append(work_f)
        polyvalent_a_bonus = (
            sum(polyvalent_a_bonus_lits) if polyvalent_a_bonus_lits else 0
        )
        polyvalent_f_bonus = (
            sum(polyvalent_f_bonus_lits) if polyvalent_f_bonus_lits else 0
        )

        # Penalize any coverage above the minimum required per (machine, day,
        # time slot). Saving manpower on shifts that already meet the min
        # avoids unnecessary cost (A+A doublons or A+F doublons when the F
        # bonus is not high enough to justify the extra body).
        extra_coverage_vars: List[cp_model.IntVar] = []
        for m_id in machine_ids:
            open_slots = machine_open_time_slots_by_machine_id.get(m_id, set())
            if not open_slots:
                continue
            downtime_set = machine_downtime_by_machine_id.get(m_id, set())
            qualified = qualified_for_machine.get(m_id, set())

            for d in days:
                if d in downtime_set:
                    continue
                for ts_id in open_slots:
                    if (m_id, d, ts_id) in machine_closed_shift:
                        continue

                    shift_overlaps: List[cp_model.IntVar] = []
                    for e_id in qualified:
                        if (e_id, d) in locked_emp_days:
                            continue
                        if (e_id, d) in unavailable:
                            continue
                        if (e_id, d, m_id) not in x or (e_id, d, ts_id) not in t:
                            continue
                        if (e_id, d, ts_id) in unavailable_shift:
                            continue
                        shift_overlaps.append(get_overlap(e_id, d, m_id, ts_id))

                    if not shift_overlaps:
                        continue

                    locked_count = locked_shift_coverage.get((m_id, d, ts_id), 0)
                    min_req = machine_shift_min_requirements.get((m_id, d, ts_id), 0)
                    upper_bound = len(shift_overlaps) + locked_count
                    if upper_bound <= min_req:
                        continue

                    extra_var = model.new_int_var(
                        0,
                        upper_bound,
                        f"extra_m{m_id}_d{d.isoformat()}_ts{ts_id}",
                    )
                    model.add(
                        extra_var >= sum(shift_overlaps) + locked_count - min_req
                    )
                    extra_coverage_vars.append(extra_var)
        extra_coverage_total = (
            sum(extra_coverage_vars) if extra_coverage_vars else 0
        )

        objective = (
            fairness_weight * fairness_cost
            - priority_weight * priority_shift_covered_sum
            - stability_weight * stability_bonus
            - training_weight * training_bonus
            - polyvalent_a_weight * polyvalent_a_bonus
            - polyvalent_f_weight * polyvalent_f_bonus
            + extra_coverage_weight * extra_coverage_total
        )
        model.minimize(objective)

        # ── Solve ────────────────────────────────────────────────────────────
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = float(req.constraints.solve_time_limit_seconds)
        solver.parameters.relative_gap_limit = float(req.constraints.relative_gap_limit)
        solver.parameters.num_search_workers = 8

        status = solver.solve(model)
        duration_ms = int((time.time() - start) * 1000)

        if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            return SolveResponse(
                ok=False,
                assignments=[],
                stats={
                    "status": str(solver.status_name(status)),
                    "durationMs": duration_ms,
                },
                error="No feasible solution found",
            )

        # ── Build results ────────────────────────────────────────────────────
        assignments: List[PlannedAssignment] = []

        # Re-emit locked-in assignments as-is.
        for (e_id, d), a in locked.items():
            assignments.append(
                PlannedAssignment(
                    day_date=d.isoformat(),
                    employee_id=e_id,
                    machine_id=a.machine_id,
                    time_slot_id=a.time_slot_id or "",
                )
            )

        # Collect solver-decided assignments.
        for e_id in employee_ids:
            for d in days:
                if (e_id, d) not in assigned_any:
                    continue
                if solver.value(assigned_any[(e_id, d)]) != 1:
                    continue

                chosen_machine_id: Optional[str] = None
                for m_id in machine_ids:
                    if (e_id, d, m_id) in x and solver.value(x[(e_id, d, m_id)]) == 1:
                        chosen_machine_id = m_id
                        break

                if not chosen_machine_id:
                    continue

                chosen_time_slot_id: Optional[str] = None
                for ts_id in working_time_slot_ids:
                    if solver.value(t[(e_id, d, ts_id)]) == 1:
                        chosen_time_slot_id = ts_id
                        break

                if not chosen_time_slot_id:
                    chosen_time_slot_id = None

                assignments.append(
                    PlannedAssignment(
                        day_date=d.isoformat(),
                        employee_id=e_id,
                        machine_id=chosen_machine_id,
                        time_slot_id=chosen_time_slot_id or "",
                    )
                )

        return SolveResponse(
            ok=True,
            assignments=assignments,
            stats={
                "solverStatus": str(solver.status_name(status)),
                "durationMs": duration_ms,
                "lockedAssignments": len(locked),
                "referenceAssignments": len(stability_keep_vars),
                "xVars": len(x),
                "tVars": len(t),
                "overlapVars": len(overlap_cache),
            },
        )
    except Exception as e:  # noqa: BLE001
        return SolveResponse(ok=False, assignments=[], stats={"durationMs": int((time.time() - start) * 1000)}, error=str(e))
