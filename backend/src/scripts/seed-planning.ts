import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

const uuid = () => randomUUID();

const MACHINES = [
  { id: uuid(), name: "Pasteurizer A", shortName: "PA", sortOrder: 1, machineGroup: "Pasteurization", maxEmployees: 2 },
  { id: uuid(), name: "Pasteurizer B", shortName: "PB", sortOrder: 2, machineGroup: "Pasteurization", maxEmployees: 2 },
  { id: uuid(), name: "Filling Line 1", shortName: "FL1", sortOrder: 3, machineGroup: "Filling", maxEmployees: 3 },
  { id: uuid(), name: "Filling Line 2", shortName: "FL2", sortOrder: 4, machineGroup: "Filling", maxEmployees: 3 },
  { id: uuid(), name: "UHT Sterilizer", shortName: "UHT", sortOrder: 5, machineGroup: "Sterilization", maxEmployees: 2 },
  { id: uuid(), name: "Homogenizer", shortName: "HOM", sortOrder: 6, machineGroup: "Processing", maxEmployees: 1 },
  { id: uuid(), name: "Separator", shortName: "SEP", sortOrder: 7, machineGroup: "Processing", maxEmployees: 1 },
  { id: uuid(), name: "Packaging Robot", shortName: "PKR", sortOrder: 8, machineGroup: "Packaging", maxEmployees: 2 },
  { id: uuid(), name: "CIP Station", shortName: "CIP", sortOrder: 9, machineGroup: "Cleaning", maxEmployees: 1 },
  { id: uuid(), name: "Cold Storage Unit", shortName: "CSU", sortOrder: 10, machineGroup: "Storage", maxEmployees: 1 },
];

const TIME_SLOTS = [
  { id: uuid(), name: "Morning", shortName: "M", color: "#FDE68A", sortOrder: 1 },
  { id: uuid(), name: "Afternoon", shortName: "A", color: "#93C5FD", sortOrder: 2 },
  { id: uuid(), name: "Night", shortName: "N", color: "#6B7280", sortOrder: 3 },
];

const STATUSES = [
  { id: uuid(), name: "Vacation", color: "#F59E0B", sortOrder: 1 },
  { id: uuid(), name: "Sick Leave", color: "#EF4444", sortOrder: 2 },
  { id: uuid(), name: "Training", color: "#8B5CF6", sortOrder: 3 },
  { id: uuid(), name: "Maternity Leave", color: "#EC4899", sortOrder: 4 },
  { id: uuid(), name: "Other Absence", color: "#9CA3AF", sortOrder: 5 },
];

const FIRST_NAMES = [
  "Marc", "Sophie", "Lucas", "Emma", "Thomas", "Lea", "Nicolas", "Laura",
  "Pierre", "Julie", "Antoine", "Camille", "Louis", "Chloe", "Arthur",
  "Manon", "Hugo", "Alice", "Julien", "Sarah", "Alexandre", "Marie",
  "Baptiste", "Charlotte", "Felix", "Elise", "Maxime", "Clara", "Gabriel",
  "Pauline", "Raphael", "Lucie", "Etienne", "Mathilde", "Olivier", "Amelie",
  "Vincent", "Noemie", "Benjamin", "Margaux", "Adrien", "Ines", "Theo",
  "Agathe", "Romain", "Jeanne", "Quentin", "Zoe", "Francois", "Valerie",
];

const LAST_NAMES = [
  "Muller", "Weber", "Schmit", "Wagner", "Becker", "Hoffmann", "Klein",
  "Schneider", "Schiltz", "Braun", "Thill", "Reuter", "Meyer", "Kieffer",
  "Kremer", "Faber", "Diederich", "Welter", "Ries", "Goergen", "Theisen",
  "Konsbruck", "Majerus", "Reding", "Berens", "Clees", "Hansen", "Steffen",
  "Pauly", "Scholtes", "Engel", "Simon", "Fischer", "Meyers", "Wolff",
  "Kayser", "Decker", "Weis", "Lentz", "Conter", "Flammang", "Schroeder",
  "Hein", "Theis", "Dostert", "Feltgen", "Biver", "Koltz", "Lux", "Zimmer",
];

function pickRandom<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function buildEmployees() {
  return Array.from({ length: 50 }, (_, i) => {
    const isBackup = i < 8;

    return {
      id: uuid(),
      firstName: FIRST_NAMES[i],
      lastName: LAST_NAMES[i],
      isBackup,
      active: true,
    };
  });
}

function buildSkills(employees: ReturnType<typeof buildEmployees>) {
  const skills: { id: string; employeeId: string; machineId: string }[] = [];
  const seen = new Set<string>();

  for (const emp of employees) {
    const skillCount = 2 + Math.floor(Math.random() * 4);
    const assignedMachines = pickRandom(MACHINES, skillCount);
    for (const m of assignedMachines) {
      const key = `${emp.id}:${m.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        skills.push({ id: uuid(), employeeId: emp.id, machineId: m.id });
      }
    }
  }

  return skills;
}

function buildUnavailableDays(
  employees: ReturnType<typeof buildEmployees>,
  statusIds: string[]
) {
  const entries: { id: string; employeeId: string; statusId: string; dayDate: Date }[] = [];
  const seen = new Set<string>();

  const year = new Date().getFullYear();
  const month = new Date().getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (const emp of employees) {
    if (Math.random() > 0.3) continue;

    const startDay = 1 + Math.floor(Math.random() * (daysInMonth - 3));
    const duration = 1 + Math.floor(Math.random() * 5);
    const statusId = statusIds[Math.floor(Math.random() * statusIds.length)];

    for (let d = startDay; d <= Math.min(startDay + duration, daysInMonth); d++) {
      const dayDate = new Date(Date.UTC(year, month, d));
      const key = `${dayDate.toISOString().slice(0, 10)}:${emp.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        entries.push({ id: uuid(), employeeId: emp.id, statusId, dayDate });
      }
    }
  }

  return entries;
}

async function seedPlanning() {
  console.log("Seeding planning test data...\n");

  console.log("Clearing existing planning data...");
  await prisma.luxlaitDailyAssignment.deleteMany();
  await prisma.luxlaitWeeklyAssignment.deleteMany();
  await prisma.luxlaitMachineDowntime.deleteMany();
  await prisma.luxlaitMachineOpenShift.deleteMany();
  await prisma.luxlaitEmployeeMachineSkill.deleteMany();
  await prisma.luxlaitWeeklyEmployeeStatus.deleteMany();
  await prisma.luxlaitMachine.deleteMany();
  await prisma.luxlaitEmployee.deleteMany();
  await prisma.luxlaitTimeSlot.deleteMany();
  await prisma.luxlaitStatus.deleteMany();
  console.log("  Cleared all planning tables\n");

  console.log("Creating machines...");
  for (const m of MACHINES) {
    await prisma.luxlaitMachine.create({ data: m });
  }
  console.log(`  + ${MACHINES.length} machines\n`);

  console.log("Creating time slots...");
  for (const ts of TIME_SLOTS) {
    await prisma.luxlaitTimeSlot.create({ data: ts });
  }
  console.log(`  + ${TIME_SLOTS.length} time slots\n`);

  console.log("Creating statuses...");
  for (const s of STATUSES) {
    await prisma.luxlaitStatus.create({ data: s });
  }
  console.log(`  + ${STATUSES.length} statuses\n`);

  const employees = buildEmployees();
  console.log("Creating employees...");
  for (const e of employees) {
    await prisma.luxlaitEmployee.create({ data: e });
  }
  const backups = employees.filter((e) => e.isBackup).length;
  console.log(`  + ${employees.length} employees (${backups} backups)\n`);

  const skills = buildSkills(employees);
  console.log("Creating skills...");
  for (const sk of skills) {
    await prisma.luxlaitEmployeeMachineSkill.create({ data: sk });
  }
  console.log(`  + ${skills.length} employee/machine skills\n`);

  const unavailable = buildUnavailableDays(employees, STATUSES.map((s) => s.id));
  console.log("Creating unavailable days (current month)...");
  for (const u of unavailable) {
    await prisma.luxlaitWeeklyEmployeeStatus.create({ data: u });
  }
  console.log(`  + ${unavailable.length} unavailable day entries\n`);

  console.log("Planning test data seeded successfully!");
  console.log("Summary:");
  console.log(`  Machines:   ${MACHINES.length}`);
  console.log(`  Time Slots: ${TIME_SLOTS.length}`);
  console.log(`  Statuses:   ${STATUSES.length}`);
  console.log(`  Employees:  ${employees.length}`);
  console.log(`  Skills:     ${skills.length}`);
  console.log(`  Unavailable: ${unavailable.length}`);
}

async function main() {
  try {
    await seedPlanning();
  } catch (error) {
    console.error("Error seeding planning data:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
