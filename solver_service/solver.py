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


def _matches_keyword(ts: TimeSlotInput, keyword: str) -> bool:
    keyword_lower = keyword.lower()
    fields = [ts.name, ts.short_name]
    return any(keyword_lower in _lower_or_empty(f) for f in fields)


def _infer_shift_sets(time_slots: Sequence[TimeSlotInput]) -> Tuple[List[str], List[str], List[str]]:
    working_time_slots = [ts.id for ts in time_slots if "repos" not in _lower_or_empty(ts.name) and "repos" not in _lower_or_empty(ts.short_name)]

    night_time_slots = [ts.id for ts in time_slots if _matches_keyword(ts, "nuit")]
    morning_time_slots = [ts.id for ts in time_slots if _matches_keyword(ts, "matin")]

    return working_time_slots, night_time_slots, morning_time_slots


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

        working_time_slot_ids, night_time_slot_ids, morning_time_slot_ids = _infer_shift_sets(time_slots)

        if not working_time_slot_ids:
            working_time_slot_ids = [ts.id for ts in time_slots]

        working_time_slot_set = set(working_time_slot_ids)
        night_time_slot_ids_set = set(night_time_slot_ids)
        morning_time_slot_ids_set = set(morning_time_slot_ids)
        has_night_and_morning = bool(night_time_slot_ids_set) and bool(morning_time_slot_ids_set)

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

        closed_days: Set[dt.date] = {
            _parse_date_yyyy_mm_dd(day)
            for day in (req.closed_days or [])
            if isinstance(day, str) and day.strip()
        }

        qualified_for_machine: Dict[str, Set[str]] = {m_id: set() for m_id in machine_ids}
        for sk in req.skills:
            if sk.machine_id in qualified_for_machine:
                qualified_for_machine[sk.machine_id].add(sk.employee_id)

        # ── Handle existing (locked-in) assignments ──────────────────────────
        # Locked-in pairs are excluded from the solver entirely. Their capacity
        # is pre-subtracted from the machine limits.
        locked: Dict[Tuple[str, dt.date], ExistingAssignmentInput] = {}
        for a in req.existing_assignments:
            ad = _parse_date_yyyy_mm_dd(a.day_date)
            if a.employee_id in employee_id_set and ad in days_set and a.machine_id in machine_id_set:
                locked[(a.employee_id, ad)] = a

        locked_emp_days: Set[Tuple[str, dt.date]] = set(locked.keys())

        # Validate locked assignments against machine downtime and open shift rules.
        for (e_id, d), a in locked.items():
            if d in closed_days:
                return SolveResponse(
                    ok=False,
                    assignments=[],
                    stats={"durationMs": int((time.time() - start) * 1000), "error": "Locked closed day conflict"},
                    error="Locked assignment exists on a closed day",
                )

            if d in machine_downtime_by_machine_id.get(a.machine_id, set()):
                return SolveResponse(
                    ok=False,
                    assignments=[],
                    stats={"durationMs": int((time.time() - start) * 1000), "error": "Locked downtime conflict"},
                    error="Locked assignment uses a machine that is down for this day",
                )

            open_slots = machine_open_time_slots_by_machine_id.get(a.machine_id, set())
            if a.time_slot_id and open_slots and a.time_slot_id not in open_slots:
                return SolveResponse(
                    ok=False,
                    assignments=[],
                    stats={"durationMs": int((time.time() - start) * 1000), "error": "Locked open shift conflict"},
                    error="Locked assignment uses a machine that is not open for this time slot",
                )

        # Count how many locked-in employees sit on each (machine, day).
        locked_capacity_used: Dict[Tuple[str, dt.date], int] = defaultdict(int)
        for (_, d), a in locked.items():
            locked_capacity_used[(a.machine_id, d)] += 1

        # Track locked-in night/morning for the rest constraint.
        locked_night: Set[Tuple[str, dt.date]] = set()
        locked_morning: Set[Tuple[str, dt.date]] = set()
        if has_night_and_morning:
            for (e_id, d), a in locked.items():
                if a.time_slot_id in night_time_slot_ids_set:
                    locked_night.add((e_id, d))
                if a.time_slot_id in morning_time_slot_ids_set:
                    locked_morning.add((e_id, d))

        # ── Build CP-SAT model ───────────────────────────────────────────────
        model = cp_model.CpModel()

        x: Dict[Tuple[str, dt.date, str], cp_model.IntVar] = {}
        assigned_any: Dict[Tuple[str, dt.date], cp_model.IntVar] = {}
        t: Dict[Tuple[str, dt.date, str], cp_model.IntVar] = {}

        for e_id in employee_ids:
            for d in days:
                if (e_id, d) in locked_emp_days:
                    continue

                assigned = model.new_bool_var(f"assigned_e{e_id}_d{d.isoformat()}")
                assigned_any[(e_id, d)] = assigned

                is_unavailable = (e_id, d) in unavailable
                is_closed_day = d in closed_days

                for m_id in machine_ids:
                    var = model.new_bool_var(f"x_e{e_id}_d{d.isoformat()}_m{m_id}")
                    x[(e_id, d, m_id)] = var

                    if is_unavailable:
                        model.add(var == 0)
                    if is_closed_day:
                        model.add(var == 0)
                    if d in machine_downtime_by_machine_id.get(m_id, set()):
                        model.add(var == 0)

                sum_x = sum(x[(e_id, d, m_id)] for m_id in machine_ids)
                model.add(sum_x == assigned)

                for ts_id in working_time_slot_ids:
                    t_var = model.new_bool_var(f"t_e{e_id}_d{d.isoformat()}_ts{ts_id}")
                    t[(e_id, d, ts_id)] = t_var

                if req.constraints.enforce_time_slot_when_assigned:
                    model.add(sum(t[(e_id, d, ts_id)] for ts_id in working_time_slot_ids) == assigned)
                else:
                    model.add(sum(t[(e_id, d, ts_id)] for ts_id in working_time_slot_ids) <= assigned)

        # ── Open shift constraint: restrict machines by time slot ─────────
        for m_id in machine_ids:
            open_slots = machine_open_time_slots_by_machine_id.get(m_id, set())
            if not open_slots:
                continue

            for e_id in employee_ids:
                for d in days:
                    if (e_id, d, m_id) not in x:
                        continue

                    compatible_lits = [
                        t[(e_id, d, ts_id)]
                        for ts_id in open_slots
                        if (e_id, d, ts_id) in t
                    ]
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
                if d in closed_days:
                    continue
                if d in downtime_set:
                    continue

                for ts_id in open_slots:
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

                        overlap = model.new_bool_var(
                            f"ov_e{e_id}_m{m_id}_d{d.isoformat()}_ts{ts_id}"
                        )
                        model.add(overlap <= x[(e_id, d, m_id)])
                        model.add(overlap <= t[(e_id, d, ts_id)])
                        model.add(overlap >= x[(e_id, d, m_id)] + t[(e_id, d, ts_id)] - 1)
                        candidate_overlap_lits.append(overlap)

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

        # Machine capacity (subtract locked-in occupants) and skills pairing
        for m_id in machine_ids:
            m = machine_by_id[m_id]
            base_max = int(m.max_employees)
            downtime_set = machine_downtime_by_machine_id.get(m_id, set())

            for d in days:
                if d in closed_days:
                    continue
                if d in downtime_set:
                    continue

                locked_count = locked_capacity_used.get((m_id, d), 0)
                free_emps = [e_id for e_id in employee_ids if (e_id, d) not in locked_emp_days]

                if not free_emps:
                    if m.importance == "MANDATORY" and locked_count < 1:
                        return SolveResponse(
                            ok=False,
                            assignments=[],
                            stats={"durationMs": int((time.time() - start) * 1000), "error": "Mandatory machine empty day"},
                            error="Mandatory machine has no available capacity on this day",
                        )
                    continue

                sum_x_md = sum(x[(e_id, d, m_id)] for e_id in free_emps)
                remaining_capacity = base_max - locked_count

                if m.importance == "MANDATORY":
                    model.add(sum_x_md + locked_count >= 1)

                if remaining_capacity <= 0:
                    model.add(sum_x_md == 0)
                    continue

                model.add(sum_x_md <= remaining_capacity)

                qualified_in_scope = qualified_for_machine.get(m_id, set())
                qualified_vars = [
                    x[(e_id, d, m_id)] for e_id in qualified_in_scope if (e_id, d, m_id) in x
                ]

                if not qualified_in_scope:
                    model.add(sum_x_md == 0)
                    continue

                used_md = model.new_bool_var(f"used_m{m_id}_d{d.isoformat()}")
                model.add(sum_x_md >= 1).only_enforce_if(used_md)
                model.add(sum_x_md == 0).only_enforce_if(used_md.Not())

                already_has_locked_qualified = any(
                    a.employee_id in qualified_in_scope
                    for (e_id2, d2), a in locked.items()
                    if d2 == d and a.machine_id == m_id
                )

                if qualified_vars:
                    if already_has_locked_qualified:
                        pass
                    else:
                        model.add(sum(qualified_vars) >= 1).only_enforce_if(used_md)
                elif not already_has_locked_qualified:
                    model.add(used_md == 0)

        # Rest constraint: no Nuit followed by Matin next day
        if has_night_and_morning:
            for e_id in employee_ids:
                for idx in range(len(days) - 1):
                    d0 = days[idx]
                    d1 = days[idx + 1]

                    d0_locked = (e_id, d0) in locked_emp_days
                    d1_locked = (e_id, d1) in locked_emp_days

                    if d0_locked and d1_locked:
                        continue

                    if d0_locked:
                        if (e_id, d0) in locked_night:
                            morning_lits = [t[(e_id, d1, ts_id)] for ts_id in morning_time_slot_ids_set if (e_id, d1, ts_id) in t]
                            if morning_lits:
                                model.add(sum(morning_lits) == 0)
                        continue

                    if d1_locked:
                        if (e_id, d1) in locked_morning:
                            night_lits = [t[(e_id, d0, ts_id)] for ts_id in night_time_slot_ids_set if (e_id, d0, ts_id) in t]
                            if night_lits:
                                model.add(sum(night_lits) == 0)
                        continue

                    night_lits = [t[(e_id, d0, ts_id)] for ts_id in night_time_slot_ids_set if (e_id, d0, ts_id) in t]
                    morning_lits_next = [t[(e_id, d1, ts_id)] for ts_id in morning_time_slot_ids_set if (e_id, d1, ts_id) in t]

                    if not night_lits or not morning_lits_next:
                        continue

                    model.add(sum(night_lits) + sum(morning_lits_next) <= 1)

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

        priority_shift_covered_sum = (
            sum(priority_shift_covered_vars) if priority_shift_covered_vars else 0
        )
        objective = (
            fairness_weight * fairness_cost
            - priority_weight * priority_shift_covered_sum
        )
        model.minimize(objective)

        # ── Solve ────────────────────────────────────────────────────────────
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = float(req.constraints.solve_time_limit_seconds)
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
                    if solver.value(x[(e_id, d, m_id)]) == 1:
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

        assignments = [a for a in assignments if a.time_slot_id]

        return SolveResponse(
            ok=True,
            assignments=assignments,
            stats={
                "solverStatus": str(solver.status_name(status)),
                "durationMs": duration_ms,
                "lockedAssignments": len(locked),
            },
        )
    except Exception as e:  # noqa: BLE001
        return SolveResponse(ok=False, assignments=[], stats={"durationMs": int((time.time() - start) * 1000)}, error=str(e))
