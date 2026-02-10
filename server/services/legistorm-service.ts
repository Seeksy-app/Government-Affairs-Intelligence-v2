import { db } from "../db";
import { legistormStaffers, legistormSyncLog } from "@shared/schema";
import { eq, ilike, or, and, sql, desc, count } from "drizzle-orm";

const BASE_URL = "https://api.legistorm.com/v2.019.10/congress";

interface LegiStormPosition {
  id: number;
  is_current: boolean;
  position_type: string;
  position_title: string;
  start_date: string | null;
  end_date: string | null;
  is_on_leave: boolean;
  member: {
    member_id: number;
    profile: {
      id: number;
      first_name: string;
      last_name: string;
      preferred_first_name: string;
      preferred_last_name: string;
      gender: string;
    };
    state_id: string;
    district_no: number | null;
    office_type_id: string;
    party: string;
  } | null;
  office: {
    office_id: number;
    name: string;
  } | null;
  updated_at: string;
}

interface LegiStormStaffResponse {
  staff: {
    id: number;
    first_name: string;
    last_name: string;
    suffix: string;
    preferred_first_name: string;
    preferred_last_name: string;
    gender: string;
    bio_details: {
      dob: string | null;
      party_name: string | null;
      race_name: string | null;
      [key: string]: any;
    };
  };
  staff_emails: Array<{
    id: number;
    contact_string: string;
    contact_type: string;
    updated_at: string;
  }>;
  office_member_addresses: Array<{
    id: number;
    is_main: boolean;
    title: string;
    address1: string;
    address2: string;
    city: string;
    zip: string;
    state_id: string;
    phone: string;
    fax: string;
    office: { office_id: number; name: string } | null;
    member: {
      member_id: number;
      profile: {
        id: number;
        first_name: string;
        last_name: string;
        preferred_first_name: string;
        preferred_last_name: string;
        gender: string;
      };
      state_id: string;
      district_no: number | null;
      office_type_id: string;
      party: string;
    } | null;
    updated_at: string;
  }>;
  positions: LegiStormPosition[];
}

function getApiKey(): string {
  const key = process.env.LEGISTORM_API_KEY;
  if (!key) throw new Error("LEGISTORM_API_KEY not configured");
  return key;
}

async function apiCall(endpoint: string, params: Record<string, string> = {}): Promise<any> {
  const url = new URL(`${BASE_URL}${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const response = await fetch(url.toString(), {
    headers: { "X-API-KEY": getApiKey() },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LegiStorm API error ${response.status}: ${text}`);
  }

  return response.json();
}

function getChamberFromOfficeType(officeTypeId: string | undefined): string | null {
  if (!officeTypeId) return null;
  if (officeTypeId === "HM" || officeTypeId === "HC") return "House";
  if (officeTypeId === "SM" || officeTypeId === "SC") return "Senate";
  return null;
}

function parseStaffResponse(item: LegiStormStaffResponse) {
  const staff = item.staff;
  const preferredFirst = staff.preferred_first_name || staff.first_name;
  const preferredLast = staff.preferred_last_name || staff.last_name;
  const fullName = `${preferredFirst} ${preferredLast}`.trim();

  const workEmail = item.staff_emails?.find(e => e.contact_type?.includes("work"))?.contact_string || 
                    item.staff_emails?.[0]?.contact_string || null;

  const mainAddress = item.office_member_addresses?.find(a => a.is_main) || item.office_member_addresses?.[0];
  const phone = mainAddress?.phone || null;
  const officeAddress = mainAddress
    ? [mainAddress.address1, mainAddress.address2, `${mainAddress.city}, ${mainAddress.state_id} ${mainAddress.zip}`]
        .filter(Boolean).join(", ")
    : null;

  const currentPosition = item.positions?.find(p => p.is_current);
  const currentTitle = currentPosition?.position_title || null;

  let currentMemberName: string | null = null;
  let currentMemberId: number | null = null;
  let currentOffice: string | null = null;
  let chamber: string | null = null;
  let state: string | null = null;
  let district: number | null = null;
  let party: string | null = staff.bio_details?.party_name || null;

  if (currentPosition?.member) {
    const m = currentPosition.member;
    const mFirst = m.profile.preferred_first_name || m.profile.first_name;
    const mLast = m.profile.preferred_last_name || m.profile.last_name;
    currentMemberName = `${mFirst} ${mLast}`.trim();
    currentMemberId = m.member_id;
    chamber = getChamberFromOfficeType(m.office_type_id);
    state = m.state_id || null;
    district = m.district_no || null;
    if (!party) party = m.party || null;
    currentOffice = `Office of ${currentMemberName}`;
  } else if (currentPosition?.office) {
    currentOffice = currentPosition.office.name;
  }

  if (!chamber && mainAddress?.member) {
    chamber = getChamberFromOfficeType(mainAddress.member.office_type_id);
  }

  const positions = (item.positions || []).map(p => ({
    id: p.id,
    title: p.position_title,
    isCurrent: p.is_current,
    startDate: p.start_date || null,
    endDate: p.end_date || null,
    memberName: p.member
      ? `${p.member.profile.preferred_first_name || p.member.profile.first_name} ${p.member.profile.preferred_last_name || p.member.profile.last_name}`.trim()
      : null,
    memberId: p.member?.member_id || null,
    officeName: p.office?.name || null,
    officeId: p.office?.office_id || null,
    chamber: p.member ? getChamberFromOfficeType(p.member.office_type_id) : null,
    state: p.member?.state_id || null,
    district: p.member?.district_no || null,
  }));

  return {
    legistormId: staff.id,
    firstName: staff.first_name,
    lastName: staff.last_name,
    preferredFirstName: staff.preferred_first_name || null,
    preferredLastName: staff.preferred_last_name || null,
    fullName,
    gender: staff.gender || null,
    party,
    race: staff.bio_details?.race_name || null,
    email: workEmail,
    phone,
    officeAddress,
    currentTitle,
    currentOffice,
    currentMemberName,
    currentMemberId,
    chamber,
    state,
    district,
    isCurrentStaff: item.positions?.some(p => p.is_current) ?? true,
    positions,
    lastUpdatedFromApi: new Date(),
  };
}

export async function syncStaffers(options: {
  updatedFrom: string;
  updatedTo: string;
  onProgress?: (processed: number, page: number) => void;
}): Promise<{ created: number; updated: number; processed: number }> {
  const { updatedFrom, updatedTo, onProgress } = options;
  let page = 1;
  const limit = 500;
  let created = 0;
  let updated = 0;
  let processed = 0;
  let hasMore = true;

  while (hasMore) {
    const data: LegiStormStaffResponse[] = await apiCall("/staff/list", {
      updated_from: updatedFrom,
      updated_to: updatedTo,
      limit: limit.toString(),
      page: page.toString(),
    });

    if (!data || !Array.isArray(data) || data.length === 0) {
      hasMore = false;
      break;
    }

    for (const item of data) {
      try {
        const parsed = parseStaffResponse(item);
        const existing = await db.select().from(legistormStaffers)
          .where(eq(legistormStaffers.legistormId, parsed.legistormId))
          .limit(1);

        if (existing.length > 0) {
          await db.update(legistormStaffers)
            .set(parsed)
            .where(eq(legistormStaffers.legistormId, parsed.legistormId));
          updated++;
        } else {
          await db.insert(legistormStaffers).values(parsed);
          created++;
        }
        processed++;
      } catch (err) {
        console.error(`Error processing staffer ${item.staff?.id}:`, err);
      }
    }

    onProgress?.(processed, page);

    if (data.length < limit) {
      hasMore = false;
    } else {
      page++;
      await new Promise(r => setTimeout(r, 500));
    }
  }

  return { created, updated, processed };
}

export async function runFullSync(): Promise<{ logId: string }> {
  const [log] = await db.insert(legistormSyncLog).values({
    syncType: "full",
    status: "running",
  }).returning();

  (async () => {
    try {
      const result = await syncStaffers({
        updatedFrom: "2020-01-01",
        updatedTo: new Date().toISOString().split("T")[0],
        onProgress: async (processed, page) => {
          await db.update(legistormSyncLog)
            .set({ recordsProcessed: processed })
            .where(eq(legistormSyncLog.id, log.id));
        },
      });

      await db.update(legistormSyncLog)
        .set({
          status: "completed",
          recordsProcessed: result.processed,
          recordsCreated: result.created,
          recordsUpdated: result.updated,
          completedAt: new Date(),
        })
        .where(eq(legistormSyncLog.id, log.id));
    } catch (error: any) {
      await db.update(legistormSyncLog)
        .set({
          status: "failed",
          errorMessage: error.message || "Unknown error",
          completedAt: new Date(),
        })
        .where(eq(legistormSyncLog.id, log.id));
    }
  })();

  return { logId: log.id };
}

export async function runIncrementalSync(): Promise<{ logId: string }> {
  const lastSync = await db.select().from(legistormSyncLog)
    .where(eq(legistormSyncLog.status, "completed"))
    .orderBy(desc(legistormSyncLog.completedAt))
    .limit(1);

  const updatedFrom = lastSync.length > 0 && lastSync[0].completedAt
    ? new Date(lastSync[0].completedAt.getTime() - 86400000).toISOString().split("T")[0]
    : "2020-01-01";

  const [log] = await db.insert(legistormSyncLog).values({
    syncType: "incremental",
    status: "running",
  }).returning();

  (async () => {
    try {
      const result = await syncStaffers({
        updatedFrom,
        updatedTo: new Date().toISOString().split("T")[0],
      });

      await db.update(legistormSyncLog)
        .set({
          status: "completed",
          recordsProcessed: result.processed,
          recordsCreated: result.created,
          recordsUpdated: result.updated,
          completedAt: new Date(),
        })
        .where(eq(legistormSyncLog.id, log.id));
    } catch (error: any) {
      await db.update(legistormSyncLog)
        .set({
          status: "failed",
          errorMessage: error.message || "Unknown error",
          completedAt: new Date(),
        })
        .where(eq(legistormSyncLog.id, log.id));
    }
  })();

  return { logId: log.id };
}

export async function searchLegistormStaffers(query: string, filters?: {
  chamber?: string;
  state?: string;
  party?: string;
  limit?: number;
  offset?: number;
}) {
  const conditions = [];

  if (query && query.trim()) {
    const searchTerm = `%${query.trim()}%`;
    conditions.push(
      or(
        ilike(legistormStaffers.fullName, searchTerm),
        ilike(legistormStaffers.currentTitle, searchTerm),
        ilike(legistormStaffers.currentOffice, searchTerm),
        ilike(legistormStaffers.currentMemberName, searchTerm),
        ilike(legistormStaffers.email, searchTerm),
      )!
    );
  }

  if (filters?.chamber && filters.chamber !== "all") {
    conditions.push(eq(legistormStaffers.chamber, filters.chamber));
  }
  if (filters?.state && filters.state !== "all") {
    conditions.push(eq(legistormStaffers.state, filters.state));
  }
  if (filters?.party && filters.party !== "all") {
    conditions.push(ilike(legistormStaffers.party, `%${filters.party}%`));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const limit = filters?.limit || 50;
  const offset = filters?.offset || 0;

  const [results, totalResult] = await Promise.all([
    db.select().from(legistormStaffers)
      .where(whereClause)
      .orderBy(legistormStaffers.fullName)
      .limit(limit)
      .offset(offset),
    db.select({ count: count() }).from(legistormStaffers)
      .where(whereClause),
  ]);

  return {
    staffers: results,
    total: totalResult[0]?.count || 0,
    limit,
    offset,
  };
}

export async function getLegistormStaffer(legistormId: number) {
  const [staffer] = await db.select().from(legistormStaffers)
    .where(eq(legistormStaffers.legistormId, legistormId))
    .limit(1);
  return staffer || null;
}

export async function cleanupStaleSyncs() {
  const staleThreshold = new Date(Date.now() - 10 * 60 * 1000);
  await db.update(legistormSyncLog)
    .set({
      status: "failed",
      errorMessage: "Sync interrupted (server restart)",
      completedAt: new Date(),
    })
    .where(
      and(
        eq(legistormSyncLog.status, "running"),
        sql`${legistormSyncLog.startedAt} < ${staleThreshold}`
      )
    );
}

export async function getSyncStatus() {
  await cleanupStaleSyncs();

  const latestSync = await db.select().from(legistormSyncLog)
    .orderBy(desc(legistormSyncLog.startedAt))
    .limit(5);

  const totalStaffers = await db.select({ count: count() }).from(legistormStaffers);
  const currentStaffers = await db.select({ count: count() }).from(legistormStaffers)
    .where(eq(legistormStaffers.isCurrentStaff, true));

  return {
    syncHistory: latestSync,
    totalStaffers: totalStaffers[0]?.count || 0,
    currentStaffers: currentStaffers[0]?.count || 0,
    isConfigured: !!process.env.LEGISTORM_API_KEY,
  };
}

export async function markRetiredStaffers(retiredIds: number[]) {
  if (retiredIds.length === 0) return;
  for (const id of retiredIds) {
    await db.update(legistormStaffers)
      .set({ isCurrentStaff: false })
      .where(eq(legistormStaffers.legistormId, id));
  }
}

export async function syncRetiredStaffers() {
  try {
    const retiredIds: number[] = await apiCall("/staff/retired-ids");
    if (Array.isArray(retiredIds) && retiredIds.length > 0) {
      await markRetiredStaffers(retiredIds);
      return retiredIds.length;
    }
    return 0;
  } catch (error) {
    console.error("Error syncing retired staffers:", error);
    return 0;
  }
}
