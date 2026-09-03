import { storage } from "../storage";
import { CongressAPI, formatBillId } from "./congress-api";
import { sendEmail, renderBrandedEmail } from "./email-service";

// Scheduled bill-change detection + email alerts. Mirrors the manual
// POST /api/tracked-bills/:id/sync logic, but runs across every tracked bill
// and actually delivers the alerts that were previously only written to
// bill_change_history.

interface BillAlert {
  billLabel: string;
  title: string;
  description: string;
}

export async function syncTrackedBillsAndAlert(): Promise<{
  billsChecked: number;
  changesDetected: number;
  emailSent: boolean;
}> {
  const apiKey = process.env.CONGRESS_API_KEY;
  if (!apiKey) {
    console.log("[bill-alerts] CONGRESS_API_KEY not set; skipping sync");
    return { billsChecked: 0, changesDetected: 0, emailSent: false };
  }

  const api = new CongressAPI(apiKey);
  const bills = await storage.getAllTrackedBills();
  const alerts: BillAlert[] = [];
  let changesDetected = 0;

  for (const bill of bills) {
    try {
      const details = await api.getBillDetails(bill.congress, bill.billType, bill.billNumber);
      const latestAction = details.bill.latestAction?.text || null;

      if (bill.latestAction === latestAction) continue;

      changesDetected++;
      const description = `New action: ${latestAction || "Unknown"}`;

      await storage.createBillChange({
        trackedBillId: bill.id,
        changeType: "action_update",
        previousValue: bill.latestAction,
        newValue: latestAction,
        description,
      });

      await storage.updateTrackedBill(bill.id, {
        title: details.bill.title,
        latestAction: latestAction ?? undefined,
        latestActionDate: details.bill.latestAction?.actionDate,
        lastSyncedAt: new Date(),
      });

      // Respect per-bill alert preferences; no preference row means defaults
      // (email on, alert on new action).
      const pref = await storage.getBillTrackingAlert(bill.id);
      if (pref && (pref.emailNotification === false || pref.alertOnNewAction === false)) {
        continue;
      }

      alerts.push({
        billLabel: formatBillId(bill.congress, bill.billType, bill.billNumber),
        title: bill.title || "",
        description,
      });
    } catch (err) {
      console.error(`[bill-alerts] sync failed for tracked bill ${bill.id}:`, err);
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
    footerNote: "You're receiving this because bill alerts are enabled for tracked legislation.",
  });
}
