import { storage } from "../storage";
import { CongressAPI } from "./congress-api";
import { sendEmail, renderBrandedEmail } from "./email-service";
import { getSessionChangeHashes, getStateBill, isLegiScanConfigured } from "./legiscan-api";
import { isStateBill, trackedBillLabel, LEGISCAN_ATTRIBUTION } from "@shared/bill-label";
import type { TrackedBill } from "@shared/schema";

// Scheduled bill-change detection + email alerts. Mirrors the manual
// POST /api/tracked-bills/:id/sync logic, but runs across every tracked bill
// and actually delivers the alerts that were previously only written to
// bill_change_history.

interface BillAlert {
  billLabel: string;
  title: string;
  description: string;
  isState: boolean;
}

// One getMasterListRaw per LegiScan session tells us every bill's current
// change_hash; getBill is spent only on tracked bills whose hash moved.
async function syncStateBills(
  bills: TrackedBill[],
  recordChange: (bill: TrackedBill, latestAction: string | null) => Promise<void>,
): Promise<void> {
  const bySession = new Map<number, TrackedBill[]>();
  const noSession: TrackedBill[] = [];
  for (const bill of bills) {
    if (bill.legiscanSessionId) {
      bySession.set(bill.legiscanSessionId, [...(bySession.get(bill.legiscanSessionId) ?? []), bill]);
    } else {
      noSession.push(bill);
    }
  }

  const changedBills: TrackedBill[] = [...noSession];
  for (const [sessionId, sessionBills] of Array.from(bySession)) {
    try {
      const hashes = await getSessionChangeHashes(sessionId);
      for (const bill of sessionBills) {
        const hash = hashes.get(bill.legiscanBillId!);
        if (hash && hash !== bill.changeHash) changedBills.push(bill);
      }
    } catch (err) {
      console.error(`[bill-alerts] LegiScan master list failed for session ${sessionId}:`, err);
    }
  }

  for (const bill of changedBills) {
    try {
      const detail = await getStateBill(bill.legiscanBillId!);
      if (detail.lastAction && detail.lastAction !== bill.latestAction) {
        await recordChange(bill, detail.lastAction);
      }
      await storage.updateTrackedBill(bill.id, {
        title: detail.title,
        status: detail.status ?? undefined,
        latestAction: detail.lastAction ?? undefined,
        latestActionDate: detail.lastActionDate ?? undefined,
        changeHash: detail.changeHash ?? undefined,
        legiscanSessionId: detail.legiscanSessionId ?? undefined,
        lastSyncedAt: new Date(),
      });
    } catch (err) {
      console.error(`[bill-alerts] LegiScan sync failed for tracked bill ${bill.id}:`, err);
    }
  }
  console.log(`[bill-alerts] state bills: ${bills.length} tracked, ${changedBills.length} fetched after change-hash check`);
}

export async function syncTrackedBillsAndAlert(): Promise<{
  billsChecked: number;
  changesDetected: number;
  emailSent: boolean;
}> {
  const bills = await storage.getAllTrackedBills();
  const federalBills = bills.filter((b) => !isStateBill(b));
  const stateBills = bills.filter((b) => isStateBill(b) && b.legiscanBillId);
  const alerts: BillAlert[] = [];
  let changesDetected = 0;

  // Records the change and queues an email alert unless the bill's alert
  // preferences opt out (no preference row means defaults: email on, alert
  // on new action).
  const recordChange = async (bill: TrackedBill, latestAction: string | null) => {
    changesDetected++;
    const description = `New action: ${latestAction || "Unknown"}`;
    await storage.createBillChange({
      trackedBillId: bill.id,
      changeType: "action_update",
      previousValue: bill.latestAction,
      newValue: latestAction,
      description,
    });
    const pref = await storage.getBillTrackingAlert(bill.id);
    if (pref && (pref.emailNotification === false || pref.alertOnNewAction === false)) return;
    alerts.push({ billLabel: trackedBillLabel(bill), title: bill.title || "", description, isState: isStateBill(bill) });
  };

  const congressKey = process.env.CONGRESS_API_KEY;
  if (!congressKey && federalBills.length > 0) {
    console.log("[bill-alerts] CONGRESS_API_KEY not set; skipping federal bills");
  }
  if (congressKey) {
    const api = new CongressAPI(congressKey);
    for (const bill of federalBills) {
      try {
        const details = await api.getBillDetails(bill.congress, bill.billType, bill.billNumber);
        const latestAction = details.bill.latestAction?.text || null;
        if (bill.latestAction === latestAction) continue;

        await recordChange(bill, latestAction);
        await storage.updateTrackedBill(bill.id, {
          title: details.bill.title,
          latestAction: latestAction ?? undefined,
          latestActionDate: details.bill.latestAction?.actionDate,
          lastSyncedAt: new Date(),
        });
      } catch (err) {
        console.error(`[bill-alerts] sync failed for tracked bill ${bill.id}:`, err);
      }
    }
  }

  if (stateBills.length > 0) {
    if (!isLegiScanConfigured()) {
      console.log("[bill-alerts] LEGISCAN_API_KEY not set; skipping state bills");
    } else {
      await syncStateBills(stateBills, recordChange);
    }
  }

  let emailSent = false;
  const alertEmail = process.env.ALERT_EMAIL;
  if (alerts.length > 0 && alertEmail) {
    try {
      await sendEmail({
        to: alertEmail,
        subject: `Bill alert: ${alerts.length} tracked bill${alerts.length === 1 ? "" : "s"} moved`,
        html: buildAlertHtml(alerts),
      });
      emailSent = true;
      console.log(`[bill-alerts] alert email sent to ${alertEmail} (${alerts.length} bills)`);
    } catch (err) {
      console.error("[bill-alerts] failed to send alert email:", err);
    }
  } else if (alerts.length > 0) {
    console.log(`[bill-alerts] ${alerts.length} alerts detected but ALERT_EMAIL is not set`);
  }

  console.log(
    `[bill-alerts] checked ${bills.length} bills, ${changesDetected} changes, email ${emailSent ? "sent" : "not sent"}`,
  );
  return { billsChecked: bills.length, changesDetected, emailSent };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildAlertHtml(alerts: BillAlert[]): string {
  const rows = alerts
    .map(
      (a) => `
    <div style="margin-bottom: 16px; padding: 14px 16px; background: #F7F6F2; border-radius: 8px; border-left: 4px solid #078ACB;">
      <p style="margin: 0 0 4px 0; font-size: 13px; font-weight: 700; color: #14253D; text-transform: uppercase; letter-spacing: 0.03em;">${escapeHtml(a.billLabel)}</p>
      <p style="margin: 0 0 6px 0; font-size: 15px; font-weight: 600; color: #14253D;">${escapeHtml(a.title)}</p>
      <p style="margin: 0; font-size: 14px; color: #5A6B80;">${escapeHtml(a.description)}</p>
    </div>`,
    )
    .join("");

  return renderBrandedEmail({
    kicker: "Bill Tracking",
    heading: "Tracked bill activity",
    bodyHtml: rows,
    cta: { label: "View in Bill Tracking", url: "https://app.governmentaffairs.io/bills" },
    footerNote:
      "You're receiving this because bill alerts are enabled for tracked legislation." +
      (alerts.some((a) => a.isState) ? ` ${LEGISCAN_ATTRIBUTION}` : ""),
  });
}
