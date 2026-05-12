import { PrismaClient, SkillLevel, MachineImportance } from "@prisma/client";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();
const uuid = () => randomUUID();

// Sentinel date used by the planning routes to mark a global, recurring
// staffing requirement that applies to every day (1970-01-01).
const GLOBAL_SHIFT_MIN_DATE = new Date("1970-01-01T00:00:00.000Z");

// Year used to seed luxlait_weekly_machine_closed_shifts. Recurring weekday
// closures are materialised for every ISO week of this year. The admin UI
// can later override or extend coverage to other years.
const SEED_YEAR = 2026;

// =============================================================================
// REFERENCE DATA (extracted from "Luxlait - Donnees planning mai 26.xlsx")
// =============================================================================

// Canonical machine names. Order = sortOrder.
const MACHINES = [
  { name: "Responsable",          shortName: "RESP", group: "Process", importance: "MANDATORY" as const },
  { name: "Préparation (mixing)", shortName: "PREP", group: "Process", importance: "MANDATORY" as const },
  { name: "Pasto 1",              shortName: "P1",   group: "Process", importance: "MANDATORY" as const },
  { name: "UHT",                  shortName: "UHT",  group: "Process", importance: "MANDATORY" as const },
  { name: "Pasto 2",              shortName: "P2",   group: "Process", importance: "MANDATORY" as const },
  { name: "Maturation",           shortName: "MAT",  group: "Process", importance: "MANDATORY" as const },
  { name: "Cottage",              shortName: "COT",  group: "Process", importance: "PRIORITY"  as const },
  { name: "Réception",            shortName: "REC",  group: "Process", importance: "MANDATORY" as const },
];

// Time slots. shortName matches typical FR planning conventions.
const TIME_SLOTS = [
  { name: "Matin",      shortName: "M", color: "#FDE68A" },
  { name: "Après-midi", shortName: "A", color: "#93C5FD" },
  { name: "Nuit",       shortName: "N", color: "#6B7280" },
];

const STATUSES = [
  { name: "Congé", color: "#F59E0B" },
];

// Maps polyvalence sheet column header -> canonical machine name.
const POLY_HEADER_TO_MACHINE: Record<string, string> = {
  "Responsable":  "Responsable",
  "Préparation":  "Préparation (mixing)",
  "Pasto 1":      "Pasto 1",
  "Pasto 2":      "Pasto 2",
  "lignes UHT":   "UHT",
  "Maturation":   "Maturation",
  "Cottage":      "Cottage",
  "Réception":    "Réception",
};

// 35 employees from "Tableau de polyvalence" sheet.
// firstName / lastName were inferred manually from the raw uppercase strings.
const EMPLOYEES: Array<{ firstName: string; lastName: string; leaveKey: string }> = [
  { firstName: "Liam",       lastName: "Albalat Albelda Peregrin", leaveKey: "albalat"    },
  { firstName: "Alban",      lastName: "Allanwa Gnamien",          leaveKey: "allanwa"    },
  { firstName: "Graziella",  lastName: "Alves Wasconcellos",       leaveKey: "alves"      },
  { firstName: "Luc",        lastName: "André",                    leaveKey: "andré"      },
  { firstName: "Mahdi",      lastName: "Azzaz",                    leaveKey: "azzaz"      },
  { firstName: "Amadou",     lastName: "Balde",                    leaveKey: "balde"      },
  { firstName: "Olivier",    lastName: "Banck",                    leaveKey: "banck"      },
  { firstName: "Anthony",    lastName: "Bay",                      leaveKey: "bay"        },
  { firstName: "Abdessalam", lastName: "Beladel",                  leaveKey: "beladel"    },
  { firstName: "Mohamed",    lastName: "Benhammou",                leaveKey: "benhammou"  },
  { firstName: "Nicolas",    lastName: "Boileau",                  leaveKey: "boileau"    },
  { firstName: "Benoit",     lastName: "Bruyere",                  leaveKey: "bruyere"    },
  { firstName: "Lea",        lastName: "Bui",                      leaveKey: "bui"        },
  { firstName: "Didier",     lastName: "Cournac",                  leaveKey: "cournac"    },
  { firstName: "Stephanie",  lastName: "Di Genni",                 leaveKey: "di genni"   },
  { firstName: "Ghislain",   lastName: "Djiepmi",                  leaveKey: "djiepmi"    },
  { firstName: "Francois",   lastName: "Dricot",                   leaveKey: "dricot"     },
  { firstName: "Frederic",   lastName: "Duterme",                  leaveKey: "duterme"    },
  { firstName: "Romain",     lastName: "Gabriel",                  leaveKey: "gabriel"    },
  { firstName: "Laurent",    lastName: "Giebens",                  leaveKey: "giebens"    },
  { firstName: "Celine",     lastName: "Goberville",               leaveKey: "goberville" },
  { firstName: "Mario",      lastName: "Granja",                   leaveKey: "granja"     },
  { firstName: "Loic",       lastName: "Guillaumot",               leaveKey: "guillaumot" },
  { firstName: "Camille",    lastName: "Lauer",                    leaveKey: "lauer"      },
  { firstName: "Maxence",    lastName: "Lehuraux",                 leaveKey: "lehuraux"   },
  { firstName: "Ludovic",    lastName: "Lesniac",                  leaveKey: "lesniac"    },
  { firstName: "Julien",     lastName: "Marotta",                  leaveKey: "marotta"    },
  { firstName: "Lola",       lastName: "Navoiseau",                leaveKey: "navoiseau"  },
  { firstName: "Amy",        lastName: "Oestreicher",              leaveKey: "oestreicher"},
  { firstName: "Marion",     lastName: "Pernet",                   leaveKey: "pernet"     },
  { firstName: "Alexandre",  lastName: "Thielen",                  leaveKey: "thielen"    },
  { firstName: "Stéphane",   lastName: "Thill",                    leaveKey: "thill"      },
  { firstName: "Julian",     lastName: "Van Acker",                leaveKey: "van acker"  },
  { firstName: "Hugo",       lastName: "Wacquet",                  leaveKey: "wacquet"    },
  { firstName: "Noelle",     lastName: "Zon Diada",                leaveKey: "zon"        },
];

// Skill matrix from polyvalence sheet.
// Tuple format: [employeeIndex (0-based), polyMachineHeader, level]
type RawLevel = "A" | "F";
const SKILLS: Array<[number, string, RawLevel]> = [
  // 1 ALBALAT
  [0, "Préparation", "F"], [0, "Pasto 1", "A"], [0, "Pasto 2", "A"], [0, "lignes UHT", "A"], [0, "Maturation", "A"],
  // 2 ALLANWA
  [1, "Pasto 2", "A"], [1, "Maturation", "A"], [1, "Réception", "A"],
  // 3 ALVES
  [2, "Pasto 1", "A"], [2, "Pasto 2", "A"], [2, "lignes UHT", "A"], [2, "Maturation", "A"], [2, "Réception", "A"],
  // 4 ANDRE
  [3, "Pasto 1", "A"], [3, "Pasto 2", "A"], [3, "lignes UHT", "A"], [3, "Maturation", "A"], [3, "Cottage", "A"], [3, "Réception", "A"],
  // 5 AZZAZ
  [4, "Responsable", "F"],
  // 6 BALDE
  [5, "Pasto 1", "F"], [5, "lignes UHT", "F"],
  // 7 BANCK
  [6, "Responsable", "A"],
  // 8 BAY
  [7, "Préparation", "A"], [7, "Pasto 1", "A"], [7, "lignes UHT", "A"],
  // 9 BELADEL
  [8, "Responsable", "A"],
  // 10 BENHAMMOU
  [9, "Préparation", "A"], [9, "Pasto 1", "A"], [9, "lignes UHT", "A"],
  // 11 BOILEAU
  [10, "Préparation", "A"], [10, "Pasto 1", "A"], [10, "Pasto 2", "A"], [10, "lignes UHT", "A"], [10, "Maturation", "A"], [10, "Cottage", "A"],
  // 12 BRUYERE
  [11, "Réception", "A"],
  // 13 BUI
  [12, "Pasto 1", "A"], [12, "lignes UHT", "A"],
  // 14 COURNAC
  [13, "Pasto 1", "A"], [13, "Pasto 2", "A"], [13, "lignes UHT", "A"], [13, "Maturation", "A"], [13, "Cottage", "A"],
  // 15 DI GENNI
  [14, "Pasto 2", "A"], [14, "Maturation", "A"],
  // 16 DJIEPMI -> no skills
  // 17 DRICOT
  [16, "Préparation", "A"], [16, "Pasto 2", "A"], [16, "Maturation", "A"], [16, "Réception", "A"],
  // 18 DUTERME
  [17, "Responsable", "A"],
  // 19 GABRIEL
  [18, "Pasto 1", "A"], [18, "lignes UHT", "A"], [18, "Réception", "A"],
  // 20 GIEBENS
  [19, "Pasto 1", "A"], [19, "Pasto 2", "A"], [19, "lignes UHT", "A"], [19, "Maturation", "A"], [19, "Cottage", "A"],
  // 21 GOBERVILLE
  [20, "Préparation", "A"],
  // 22 GRANJA
  [21, "Responsable", "A"],
  // 23 GUILLAUMOT
  [22, "Pasto 1", "A"], [22, "Pasto 2", "A"], [22, "lignes UHT", "A"], [22, "Maturation", "A"], [22, "Cottage", "A"],
  // 24 LAUER
  [23, "Responsable", "A"],
  // 25 LEHURAUX
  [24, "Préparation", "A"],
  // 26 LESNIAC
  [25, "Préparation", "F"],
  // 27 MAROTTA
  [26, "Préparation", "A"], [26, "Pasto 2", "A"], [26, "Maturation", "A"],
  // 28 NAVOISEAU
  [27, "Pasto 1", "F"], [27, "lignes UHT", "F"], [27, "Réception", "A"],
  // 29 OESTREICHER
  [28, "Pasto 2", "A"], [28, "Maturation", "A"],
  // 30 PERNET
  [29, "Pasto 1", "A"], [29, "Pasto 2", "A"], [29, "lignes UHT", "A"], [29, "Maturation", "A"], [29, "Cottage", "A"],
  // 31 THIELEN
  [30, "Préparation", "A"], [30, "Pasto 1", "A"], [30, "Pasto 2", "A"], [30, "lignes UHT", "A"], [30, "Maturation", "A"],
  // 32 THILL
  [31, "Pasto 1", "A"], [31, "Pasto 2", "A"], [31, "lignes UHT", "A"], [31, "Maturation", "A"],
  // 33 VAN ACKER
  [32, "Pasto 1", "A"], [32, "Pasto 2", "A"],
  // 34 WACQUET
  [33, "Pasto 1", "A"], [33, "Pasto 2", "A"], [33, "lignes UHT", "A"], [33, "Maturation", "A"],
  // 35 ZON
  [34, "Réception", "A"],
];

// Staffing matrix from "Personnel 2026" sheet.
// Tuple format: [machineName, slotName, weekdayJS (0=Sun..6=Sat), value]
type StaffCell = [string, string, number, number];
const STAFFING: StaffCell[] = [
  ["Responsable","Matin",1,1],["Responsable","Matin",2,1],["Responsable","Matin",3,1],["Responsable","Matin",4,1],["Responsable","Matin",5,1],["Responsable","Matin",6,1],["Responsable","Matin",0,1],
  ["Responsable","Après-midi",1,1],["Responsable","Après-midi",2,1],["Responsable","Après-midi",3,1],["Responsable","Après-midi",4,1],["Responsable","Après-midi",5,1],["Responsable","Après-midi",6,0],["Responsable","Après-midi",0,0],
  ["Responsable","Nuit",1,1],["Responsable","Nuit",2,1],["Responsable","Nuit",3,1],["Responsable","Nuit",4,1],["Responsable","Nuit",5,1],["Responsable","Nuit",6,0],["Responsable","Nuit",0,0],

  ["Préparation (mixing)","Matin",1,1],["Préparation (mixing)","Matin",2,1],["Préparation (mixing)","Matin",3,1],["Préparation (mixing)","Matin",4,1],["Préparation (mixing)","Matin",5,1],["Préparation (mixing)","Matin",6,1],["Préparation (mixing)","Matin",0,0],
  ["Préparation (mixing)","Après-midi",1,1],["Préparation (mixing)","Après-midi",2,1],["Préparation (mixing)","Après-midi",3,1],["Préparation (mixing)","Après-midi",4,1],["Préparation (mixing)","Après-midi",5,1],["Préparation (mixing)","Après-midi",6,1],["Préparation (mixing)","Après-midi",0,0],
  ["Préparation (mixing)","Nuit",1,1],["Préparation (mixing)","Nuit",2,1],["Préparation (mixing)","Nuit",3,1],["Préparation (mixing)","Nuit",4,1],["Préparation (mixing)","Nuit",5,1],["Préparation (mixing)","Nuit",6,0],["Préparation (mixing)","Nuit",0,0],

  ["Pasto 1","Matin",1,1],["Pasto 1","Matin",2,1],["Pasto 1","Matin",3,1],["Pasto 1","Matin",4,1],["Pasto 1","Matin",5,1],["Pasto 1","Matin",6,1],["Pasto 1","Matin",0,1],
  ["Pasto 1","Après-midi",1,1],["Pasto 1","Après-midi",2,1],["Pasto 1","Après-midi",3,1],["Pasto 1","Après-midi",4,1],["Pasto 1","Après-midi",5,1],["Pasto 1","Après-midi",6,1],["Pasto 1","Après-midi",0,1],
  ["Pasto 1","Nuit",1,1],["Pasto 1","Nuit",2,1],["Pasto 1","Nuit",3,1],["Pasto 1","Nuit",4,1],["Pasto 1","Nuit",5,1],["Pasto 1","Nuit",6,1],["Pasto 1","Nuit",0,1],

  ["UHT","Matin",1,1],["UHT","Matin",2,1],["UHT","Matin",3,1],["UHT","Matin",4,1],["UHT","Matin",5,1],["UHT","Matin",6,0],["UHT","Matin",0,0],
  ["UHT","Après-midi",1,1],["UHT","Après-midi",2,1],["UHT","Après-midi",3,1],["UHT","Après-midi",4,1],["UHT","Après-midi",5,1],["UHT","Après-midi",6,0],["UHT","Après-midi",0,0],
  ["UHT","Nuit",1,1],["UHT","Nuit",2,1],["UHT","Nuit",3,1],["UHT","Nuit",4,1],["UHT","Nuit",5,1],["UHT","Nuit",6,0],["UHT","Nuit",0,0],

  ["Pasto 2","Matin",1,1],["Pasto 2","Matin",2,1],["Pasto 2","Matin",3,1],["Pasto 2","Matin",4,1],["Pasto 2","Matin",5,1],["Pasto 2","Matin",6,1],["Pasto 2","Matin",0,1],
  ["Pasto 2","Après-midi",1,1],["Pasto 2","Après-midi",2,1],["Pasto 2","Après-midi",3,1],["Pasto 2","Après-midi",4,1],["Pasto 2","Après-midi",5,1],["Pasto 2","Après-midi",6,1],["Pasto 2","Après-midi",0,1],
  ["Pasto 2","Nuit",1,1],["Pasto 2","Nuit",2,1],["Pasto 2","Nuit",3,1],["Pasto 2","Nuit",4,1],["Pasto 2","Nuit",5,1],["Pasto 2","Nuit",6,1],["Pasto 2","Nuit",0,1],

  ["Maturation","Matin",1,1],["Maturation","Matin",2,1],["Maturation","Matin",3,1],["Maturation","Matin",4,1],["Maturation","Matin",5,1],["Maturation","Matin",6,0],["Maturation","Matin",0,0],
  ["Maturation","Après-midi",1,1],["Maturation","Après-midi",2,1],["Maturation","Après-midi",3,1],["Maturation","Après-midi",4,1],["Maturation","Après-midi",5,1],["Maturation","Après-midi",6,0],["Maturation","Après-midi",0,0],
  ["Maturation","Nuit",1,1],["Maturation","Nuit",2,1],["Maturation","Nuit",3,1],["Maturation","Nuit",4,1],["Maturation","Nuit",5,1],["Maturation","Nuit",6,0],["Maturation","Nuit",0,1],

  ["Cottage","Matin",1,1],["Cottage","Matin",2,0],["Cottage","Matin",3,1],["Cottage","Matin",4,1],["Cottage","Matin",5,1],["Cottage","Matin",6,0],["Cottage","Matin",0,0],
  ["Cottage","Après-midi",1,1],["Cottage","Après-midi",2,1],["Cottage","Après-midi",3,0],["Cottage","Après-midi",4,1],["Cottage","Après-midi",5,0],["Cottage","Après-midi",6,0],["Cottage","Après-midi",0,0],
  ["Cottage","Nuit",1,1],["Cottage","Nuit",2,1],["Cottage","Nuit",3,0],["Cottage","Nuit",4,1],["Cottage","Nuit",5,0],["Cottage","Nuit",6,0],["Cottage","Nuit",0,0],

  ["Réception","Matin",1,1],["Réception","Matin",2,1],["Réception","Matin",3,1],["Réception","Matin",4,1],["Réception","Matin",5,1],["Réception","Matin",6,1],["Réception","Matin",0,1],
  ["Réception","Après-midi",1,1],["Réception","Après-midi",2,1],["Réception","Après-midi",3,1],["Réception","Après-midi",4,1],["Réception","Après-midi",5,1],["Réception","Après-midi",6,1],["Réception","Après-midi",0,1],
  ["Réception","Nuit",1,1],["Réception","Nuit",2,1],["Réception","Nuit",3,1],["Réception","Nuit",4,1],["Réception","Nuit",5,1],["Réception","Nuit",6,1],["Réception","Nuit",0,1],
];

// Leaves from "Congé mai 2026" sheet.
// Tuple format: [employeeLeaveKey, "YYYY-MM-DD"]
const LEAVES: Array<[string, string]> = [
  ["albalat", "2026-05-12"], ["albalat", "2026-05-13"], ["albalat", "2026-05-15"], ["albalat", "2026-05-18"], ["albalat", "2026-05-19"], ["albalat", "2026-05-29"],
  ["allanwa", "2026-05-11"],
  ["andré", "2026-05-18"], ["andré", "2026-05-19"], ["andré", "2026-05-20"], ["andré", "2026-05-21"], ["andré", "2026-05-22"],
  ["azzaz", "2026-05-15"],
  ["banck", "2026-05-11"], ["banck", "2026-05-12"], ["banck", "2026-05-13"], ["banck", "2026-05-15"],
  ["beladel", "2026-05-25"], ["beladel", "2026-05-26"], ["beladel", "2026-05-27"], ["beladel", "2026-05-28"], ["beladel", "2026-05-29"],
  ["cournac", "2026-05-12"], ["cournac", "2026-05-27"],
  ["di genni", "2026-05-11"], ["di genni", "2026-05-12"], ["di genni", "2026-05-13"], ["di genni", "2026-05-15"], ["di genni", "2026-05-27"],
  ["duterme", "2026-05-04"],
  ["gabriel", "2026-05-11"],
  ["giebens", "2026-05-11"], ["giebens", "2026-05-12"], ["giebens", "2026-05-13"], ["giebens", "2026-05-15"], ["giebens", "2026-05-18"],
  ["pernet", "2026-05-04"], ["pernet", "2026-05-05"], ["pernet", "2026-05-06"], ["pernet", "2026-05-07"], ["pernet", "2026-05-08"],
  ["thielen", "2026-05-08"], ["thielen", "2026-05-19"],
  ["thill", "2026-05-22"],
  ["van acker", "2026-05-18"], ["van acker", "2026-05-19"], ["van acker", "2026-05-20"], ["van acker", "2026-05-21"], ["van acker", "2026-05-22"],
  ["zon", "2026-05-18"], ["zon", "2026-05-19"], ["zon", "2026-05-20"],
];

// =============================================================================
// SEED LOGIC
// =============================================================================

async function purgePlanning() {
  console.log("Purging existing planning data...");
  await prisma.luxlaitDailyAssignment.deleteMany();
  await prisma.luxlaitWeeklyAssignment.deleteMany();
  await prisma.luxlaitWeeklyEmployeeShiftStatus.deleteMany();
  await prisma.luxlaitWeeklyEmployeeStatus.deleteMany();
  await prisma.luxlaitDefaultLeave.deleteMany();
  await prisma.luxlaitMachineDowntimeShift.deleteMany();
  await prisma.luxlaitMachineDowntime.deleteMany();
  await prisma.luxlaitDefaultMachineDowntime.deleteMany();
  await prisma.luxlaitWeeklyMachineClosedShift.deleteMany();
  await prisma.luxlaitMachineStaffingRequirement.deleteMany();
  await prisma.luxlaitMachineOpenShift.deleteMany();
  await prisma.luxlaitEmployeeMachineSkill.deleteMany();
  await prisma.luxlaitMachine.deleteMany();
  await prisma.luxlaitEmployee.deleteMany();
  await prisma.luxlaitTimeSlot.deleteMany();
  await prisma.luxlaitStatus.deleteMany();
  console.log("  All luxlait_* tables cleared.\n");
}

async function seed() {
  await purgePlanning();

  // ------------------------------------------------------------------ Machines
  console.log("Creating machines...");
  const machineIdByName = new Map<string, string>();
  for (let i = 0; i < MACHINES.length; i++) {
    const m = MACHINES[i];
    const id = uuid();
    machineIdByName.set(m.name, id);
    await prisma.luxlaitMachine.create({
      data: {
        id,
        name: m.name,
        shortName: m.shortName,
        machineGroup: m.group,
        sortOrder: i + 1,
        // Set to 2 so that an IN_TRAINING employee can be paired with an
        // AUTONOMOUS one on the same shift (the trainee is "above" the
        // minimum staffing requirement, never replacing it).
        maxEmployees: 2,
        importance: m.importance as MachineImportance,
      },
    });
  }
  console.log(`  + ${MACHINES.length} machines\n`);

  // ----------------------------------------------------------------- TimeSlots
  console.log("Creating time slots...");
  const slotIdByName = new Map<string, string>();
  for (let i = 0; i < TIME_SLOTS.length; i++) {
    const s = TIME_SLOTS[i];
    const id = uuid();
    slotIdByName.set(s.name, id);
    await prisma.luxlaitTimeSlot.create({
      data: { id, name: s.name, shortName: s.shortName, color: s.color, sortOrder: i + 1 },
    });
  }
  console.log(`  + ${TIME_SLOTS.length} time slots\n`);

  // ------------------------------------------------------------------ Statuses
  console.log("Creating statuses...");
  const statusIdByName = new Map<string, string>();
  for (let i = 0; i < STATUSES.length; i++) {
    const s = STATUSES[i];
    const id = uuid();
    statusIdByName.set(s.name, id);
    await prisma.luxlaitStatus.create({
      data: { id, name: s.name, color: s.color, sortOrder: i + 1 },
    });
  }
  console.log(`  + ${STATUSES.length} statuses\n`);

  // ----------------------------------------------------------------- Employees
  console.log("Creating employees...");
  const employeeIdByLeaveKey = new Map<string, string>();
  const employeeIdByIndex: string[] = [];
  for (const e of EMPLOYEES) {
    const id = uuid();
    employeeIdByIndex.push(id);
    employeeIdByLeaveKey.set(e.leaveKey, id);
    await prisma.luxlaitEmployee.create({
      data: { id, firstName: e.firstName, lastName: e.lastName, isBackup: false, active: true },
    });
  }
  console.log(`  + ${EMPLOYEES.length} employees\n`);

  // ------------------------------------------------------------------- Skills
  console.log("Creating employee/machine skills...");
  let skillCount = 0;
  for (const [empIdx, polyHeader, raw] of SKILLS) {
    const machineName = POLY_HEADER_TO_MACHINE[polyHeader];
    if (!machineName) {
      throw new Error(`Unknown polyvalence header: ${polyHeader}`);
    }
    const machineId = machineIdByName.get(machineName);
    const employeeId = employeeIdByIndex[empIdx];
    if (!machineId || !employeeId) {
      throw new Error(`Cannot resolve skill for employeeIdx=${empIdx}, machine=${machineName}`);
    }
    const level: SkillLevel = raw === "A" ? "AUTONOMOUS" : "IN_TRAINING";
    await prisma.luxlaitEmployeeMachineSkill.create({
      data: { id: uuid(), employeeId, machineId, level },
    });
    skillCount++;
  }
  const autonomous = SKILLS.filter(([, , l]) => l === "A").length;
  const training = SKILLS.filter(([, , l]) => l === "F").length;
  console.log(`  + ${skillCount} skills (${autonomous} autonomous, ${training} in training)\n`);

  // -------------------------------------------------------- Open shifts + closed weekday shifts + global staffing
  console.log("Creating open shifts, closed weekday shifts, and global staffing requirements...");
  const openShiftSeen = new Set<string>(); // machineId|slotId
  let openCount = 0;
  let closedCount = 0;
  let staffingCount = 0;

  // First pass: aggregate per (machine, slot) which weekdays are closed (value=0)
  // and which are open (value>0).
  type Agg = { closedWeekdays: Set<number>; minStaff: number };
  const aggByPair = new Map<string, Agg>();
  for (const [machineName, slotName, weekday, value] of STAFFING) {
    const machineId = machineIdByName.get(machineName);
    const slotId = slotIdByName.get(slotName);
    if (!machineId || !slotId) {
      throw new Error(`Unknown machine/slot: ${machineName}/${slotName}`);
    }
    const key = `${machineId}|${slotId}`;
    const agg = aggByPair.get(key) ?? { closedWeekdays: new Set<number>(), minStaff: 0 };
    if (value === 0) {
      agg.closedWeekdays.add(weekday);
    } else {
      agg.minStaff = Math.max(agg.minStaff, value);
    }
    aggByPair.set(key, agg);
  }

  for (const [key, agg] of aggByPair) {
    const [machineId, slotId] = key.split("|");
    if (!openShiftSeen.has(key)) {
      openShiftSeen.add(key);
      // Always open the shift slot for each machine that has at least one
      // weekday with non zero requirement OR has any closures (we still want
      // the slot configured even if every weekday is closed -- defensive).
      if (agg.minStaff > 0 || agg.closedWeekdays.size < 7) {
        await prisma.luxlaitMachineOpenShift.create({
          data: { id: uuid(), machineId, timeSlotId: slotId },
        });
        openCount++;
      }
    }
    for (const wd of agg.closedWeekdays) {
      // Seed every ISO week of SEED_YEAR so the closure applies year round.
      // Frontend admin UI can later override individual weeks.
      for (let week = 1; week <= 53; week++) {
        await prisma.luxlaitWeeklyMachineClosedShift.create({
          data: {
            id: uuid(),
            year: SEED_YEAR,
            isoWeek: week,
            machineId,
            weekday: wd,
            timeSlotId: slotId,
          },
        });
        closedCount++;
      }
    }
    if (agg.minStaff > 0) {
      await prisma.luxlaitMachineStaffingRequirement.create({
        data: {
          id: uuid(),
          machineId,
          dayDate: GLOBAL_SHIFT_MIN_DATE,
          timeSlotId: slotId,
          minEmployees: agg.minStaff,
        },
      });
      staffingCount++;
    }
  }
  console.log(`  + ${openCount} open shifts`);
  console.log(`  + ${closedCount} closed weekday shifts`);
  console.log(`  + ${staffingCount} global staffing requirements\n`);

  // -------------------------------------------------------------------- Leaves
  console.log("Creating leaves (Congé) for May 2026...");
  const congeStatusId = statusIdByName.get("Congé")!;
  let leaveCount = 0;
  for (const [leaveKey, dateStr] of LEAVES) {
    const employeeId = employeeIdByLeaveKey.get(leaveKey);
    if (!employeeId) {
      throw new Error(`Cannot match leave entry "${leaveKey}" to an employee`);
    }
    const dayDate = new Date(`${dateStr}T00:00:00.000Z`);
    // Insert in both the active table and the default catalogue. The
    // catalogue is used by the "Clear month" admin action to restore the
    // baseline leaves after wiping the planning.
    await prisma.luxlaitWeeklyEmployeeStatus.create({
      data: { id: uuid(), employeeId, statusId: congeStatusId, dayDate },
    });
    await prisma.luxlaitDefaultLeave.create({
      data: { id: uuid(), employeeId, statusId: congeStatusId, dayDate },
    });
    leaveCount++;
  }
  console.log(`  + ${leaveCount} leave day entries (active + default catalogue)\n`);

  console.log("Seed complete. Summary:");
  console.log(`  Machines:    ${MACHINES.length}`);
  console.log(`  Time slots:  ${TIME_SLOTS.length}`);
  console.log(`  Statuses:    ${STATUSES.length}`);
  console.log(`  Employees:   ${EMPLOYEES.length}`);
  console.log(`  Skills:      ${skillCount} (A=${autonomous}, F=${training})`);
  console.log(`  Open shifts: ${openCount}`);
  console.log(`  Closed wd shifts: ${closedCount}`);
  console.log(`  Global staffing requirements: ${staffingCount}`);
  console.log(`  Leaves:      ${leaveCount}`);
}

async function main() {
  try {
    await seed();
  } catch (err) {
    console.error("Seed failed:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
