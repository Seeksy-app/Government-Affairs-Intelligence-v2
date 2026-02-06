import { db } from "../db";
import { congressionalStaffDirectory } from "@shared/schema";
import { eq, ilike, or, and, sql } from "drizzle-orm";

interface HouseEmployee {
  _id: string;
  name: string;
  jobTitle: string;
  stafferType: string | null;
  telephone: string;
  address: { streetAddress: string };
  worksFor: {
    _id: string;
    name: string;
    description?: string;
    address?: { streetAddress: string };
    parentOrganization?: {
      _id: string;
      name: string;
      description?: string;
    };
  };
}

interface HouseOffice {
  _id: string;
  name: string;
  description: string;
  address: { streetAddress: string; addressLocality?: string; addressRegion?: string; postalCode?: string };
  parentOrganization?: {
    _id: string;
    name: string;
    description?: string;
  };
}

interface StaffDirectoryEntry {
  employeeId: string;
  name: string;
  jobTitle: string;
  officeCode: string;
  officeName: string;
  officeType: string;
  telephone: string;
  address: string;
  parentOfficeCode: string | null;
  parentOfficeName: string | null;
}

function formatPhoneNumber(phone: string): string {
  if (!phone || phone.length !== 10) return phone;
  return `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}`;
}

function formatName(name: string): string {
  if (!name) return name;
  const cleaned = name.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  const parts = cleaned.split(',').map(p => p.trim());
  if (parts.length >= 2) {
    return `${parts[1]} ${parts[0]}`;
  }
  return cleaned;
}

function formatJobTitle(title: string): string {
  if (!title) return title;
  return title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

export async function scrapeHouseDirectory(): Promise<{ employees: HouseEmployee[]; offices: HouseOffice[] }> {
  console.log("[House Directory] Fetching directory data from directory.house.gov...");

  const response = await fetch("https://directory.house.gov/");
  if (!response.ok) {
    throw new Error(`Failed to fetch House directory: ${response.status}`);
  }

  const html = await response.text();
  console.log(`[House Directory] Downloaded ${(html.length / 1024 / 1024).toFixed(1)}MB of data`);

  const empMatch = html.match(/\.value\("employees",\s*(\[[\s\S]*?\])\)/);
  const officeMatch = html.match(/\.value\("offices",\s*(\[[\s\S]*?\])\)/);

  if (!empMatch) {
    throw new Error("Could not extract employee data from House directory");
  }

  const employees: HouseEmployee[] = JSON.parse(empMatch[1]);
  const offices: HouseOffice[] = officeMatch ? JSON.parse(officeMatch[1]) : [];

  console.log(`[House Directory] Parsed ${employees.length} employees and ${offices.length} offices`);
  return { employees, offices };
}

export async function syncHouseDirectoryToDb(): Promise<{ synced: number; errors: number }> {
  const { employees, offices } = await scrapeHouseDirectory();

  const officeMap = new Map<string, HouseOffice>();
  for (const office of offices) {
    officeMap.set(office._id, office);
  }

  await db.delete(congressionalStaffDirectory).execute();

  let synced = 0;
  let errors = 0;
  const batchSize = 100;

  for (let i = 0; i < employees.length; i += batchSize) {
    const batch = employees.slice(i, i + batchSize);
    const records = batch.map(emp => {
      const office = officeMap.get(emp.worksFor?._id || "");
      const parentOffice = office?.parentOrganization || emp.worksFor?.parentOrganization;
      return {
        employeeId: emp._id,
        name: emp.name,
        jobTitle: formatJobTitle(emp.jobTitle),
        officeCode: emp.worksFor?._id || null,
        officeName: emp.worksFor?.name?.replace(/&amp;/g, '&') || null,
        officeType: office?.description || emp.worksFor?.description || null,
        telephone: emp.telephone || null,
        address: emp.address?.streetAddress || office?.address?.streetAddress || null,
        parentOfficeCode: parentOffice?._id || null,
        parentOfficeName: parentOffice?.name?.replace(/&amp;/g, '&') || null,
      };
    });

    try {
      await db.insert(congressionalStaffDirectory).values(records as any[]);
      synced += records.length;
    } catch (err) {
      console.error(`[House Directory] Batch error at index ${i}:`, err);
      errors += batch.length;
    }
  }

  console.log(`[House Directory] Sync complete: ${synced} synced, ${errors} errors`);
  return { synced, errors };
}

export async function lookupStaffByMember(
  memberLastName: string,
  memberFirstName?: string,
  state?: string
): Promise<StaffDirectoryEntry[]> {
  const cachedCount = await db.select({ count: sql<number>`count(*)` })
    .from(congressionalStaffDirectory)
    .then(r => Number(r[0]?.count || 0));

  if (cachedCount === 0) {
    console.log("[House Directory] Cache empty, syncing from directory.house.gov...");
    await syncHouseDirectoryToDb();
  }

  const patterns: string[] = [];
  if (memberFirstName) {
    patterns.push(`${memberLastName}, ${memberFirstName}%`);
    patterns.push(`%${memberFirstName} ${memberLastName}%`);
  }
  patterns.push(`${memberLastName}%`);

  const conditions = patterns.map(p => ilike(congressionalStaffDirectory.officeName, p));
  if (state) {
    const stateConditions = patterns.map(p => {
      const cond = and(ilike(congressionalStaffDirectory.officeName, p), ilike(congressionalStaffDirectory.officeCode, `${state}%`));
      return cond!;
    });
    conditions.push(...stateConditions);
  }

  const results = await db.select()
    .from(congressionalStaffDirectory)
    .where(or(...conditions)!);

  const memberOffices = new Set<string>();
  for (const r of results) {
    if (r.officeCode) memberOffices.add(r.officeCode);
  }

  if (memberOffices.size === 0) {
    const parentResults = await db.select()
      .from(congressionalStaffDirectory)
      .where(or(
        ...patterns.map(p => ilike(congressionalStaffDirectory.parentOfficeName, p))
      ));
    for (const r of parentResults) {
      if (r.officeCode) memberOffices.add(r.officeCode);
      if (r.parentOfficeCode) memberOffices.add(r.parentOfficeCode);
    }
  }

  if (memberOffices.size === 0) {
    return [];
  }

  const allStaff = await db.select()
    .from(congressionalStaffDirectory)
    .where(or(
      ...Array.from(memberOffices).map(code => eq(congressionalStaffDirectory.officeCode, code)),
      ...Array.from(memberOffices).map(code => eq(congressionalStaffDirectory.parentOfficeCode, code))
    ));

  return allStaff.map(s => ({
    employeeId: s.employeeId || "",
    name: formatName(s.name),
    jobTitle: s.jobTitle,
    officeCode: s.officeCode || "",
    officeName: s.officeName || "",
    officeType: s.officeType || "",
    telephone: formatPhoneNumber(s.telephone || ""),
    address: s.address || "",
    parentOfficeCode: s.parentOfficeCode || null,
    parentOfficeName: s.parentOfficeName || null,
  }));
}

export async function lookupStaffByOfficeCode(officeCode: string): Promise<StaffDirectoryEntry[]> {
  const cachedCount = await db.select({ count: sql<number>`count(*)` })
    .from(congressionalStaffDirectory)
    .then(r => Number(r[0]?.count || 0));

  if (cachedCount === 0) {
    await syncHouseDirectoryToDb();
  }

  const results = await db.select()
    .from(congressionalStaffDirectory)
    .where(or(
      eq(congressionalStaffDirectory.officeCode, officeCode),
      eq(congressionalStaffDirectory.parentOfficeCode, officeCode)
    ));

  return results.map(s => ({
    employeeId: s.employeeId || "",
    name: formatName(s.name),
    jobTitle: s.jobTitle,
    officeCode: s.officeCode || "",
    officeName: s.officeName || "",
    officeType: s.officeType || "",
    telephone: formatPhoneNumber(s.telephone || ""),
    address: s.address || "",
    parentOfficeCode: s.parentOfficeCode || null,
    parentOfficeName: s.parentOfficeName || null,
  }));
}

export async function searchStaffDirectory(query: string): Promise<StaffDirectoryEntry[]> {
  const cachedCount = await db.select({ count: sql<number>`count(*)` })
    .from(congressionalStaffDirectory)
    .then(r => Number(r[0]?.count || 0));

  if (cachedCount === 0) {
    await syncHouseDirectoryToDb();
  }

  const results = await db.select()
    .from(congressionalStaffDirectory)
    .where(or(
      ilike(congressionalStaffDirectory.name, `%${query}%`),
      ilike(congressionalStaffDirectory.jobTitle, `%${query}%`),
      ilike(congressionalStaffDirectory.officeName, `%${query}%`)
    ))
    .limit(100);

  return results.map(s => ({
    employeeId: s.employeeId || "",
    name: formatName(s.name),
    jobTitle: s.jobTitle,
    officeCode: s.officeCode || "",
    officeName: s.officeName || "",
    officeType: s.officeType || "",
    telephone: formatPhoneNumber(s.telephone || ""),
    address: s.address || "",
    parentOfficeCode: s.parentOfficeCode || null,
    parentOfficeName: s.parentOfficeName || null,
  }));
}

export async function getDirectoryStats(): Promise<{
  totalEmployees: number;
  lastSynced: Date | null;
}> {
  const result = await db.select({
    count: sql<number>`count(*)`,
    lastSynced: sql<Date>`max(last_synced_at)`,
  }).from(congressionalStaffDirectory);

  return {
    totalEmployees: Number(result[0]?.count || 0),
    lastSynced: result[0]?.lastSynced || null,
  };
}
