import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Building2,
  CheckCircle2,
  Copy,
  ExternalLink,
  LogOut,
  Mail,
  Palette,
  Plug,
  Shield,
  SlidersHorizontal,
  UserRound,
  UserPlus,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useFirmSetup } from "@/hooks/use-firm-setup";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { friendlyError } from "@/lib/api-errors";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import { PageHeader, PageShell } from "@/components/page-header";
import { AGENCIES, WEATHER_IMPACT, type FirmOnboarding } from "@shared/onboarding";

interface UserRole {
  isSuperAdmin: boolean;
  clientId?: string;
  clientName?: string;
  role?: string;
  impersonatingClientId?: string;
}

interface MiroStatus {
  connected: boolean;
  hasCredentials: boolean;
  needsAuth?: boolean;
  user?: { name?: string; email?: string };
}

const SECTIONS = [
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "firm", label: "Firm", icon: Building2 },
  { id: "practice", label: "Practice & Today", icon: SlidersHorizontal },
  { id: "team", label: "Sign-up link", icon: UserPlus },
  { id: "integrations", label: "Integrations", icon: Plug },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "account", label: "Account", icon: LogOut },
];

// One settings page, sectioned: a sticky index on the left, each section a
// card with its own Save. Everything a firm can change lives here or one
// click away (onboarding answers).
export default function SettingsPage() {
  const { user } = useAuth();
  const { data: userRole } = useQuery<UserRole>({ queryKey: ["/api/user/role"], enabled: !!user });
  const hasFirm = !!userRole?.clientId || !!userRole?.impersonatingClientId;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Settings"
        title={<span data-testid="text-settings-title">Settings</span>}
        description="Your profile, your firm, and how GovernmentAffairs.io works for you."
      />
      <div className="grid items-start gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav className="sticky top-4 hidden lg:block" aria-label="Settings sections">
          <ul className="space-y-0.5">
            {SECTIONS.filter((s) => hasFirm || !["firm", "practice"].includes(s.id)).map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <s.icon className="h-4 w-4" />
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 max-w-5xl space-y-6">
          <ProfileSection role={userRole} />
          {hasFirm && <FirmSection role={userRole} />}
          {hasFirm && <PracticeSection />}
          <InviteSection />
          <IntegrationsSection />
          <Section id="appearance" title="Appearance" description="Light or dark. Your choice is remembered on this device.">
            <Row label="Theme" hint="Switch between light and dark mode">
              <ThemeToggle />
            </Row>
          </Section>
          <AccountSection />
        </div>
      </div>
    </PageShell>
  );
}

function Section({
  id,
  title,
  description,
  children,
  footer,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-6 overflow-hidden rounded-xl border bg-card shadow-sm" data-testid={`settings-${id}`}>
      <div className="border-b px-6 py-4">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="px-6 py-5">{children}</div>
      {footer && <div className="flex items-center justify-end gap-2 border-t bg-muted/30 px-6 py-3">{footer}</div>}
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 py-2 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      {hint && <span className="ml-1.5 text-xs text-muted-foreground">{hint}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function useSaveToast() {
  const { toast } = useToast();
  return {
    ok: (title: string) => toast({ title }),
    fail: (err: Error) => toast({ title: "Couldn't save", description: friendlyError(err), variant: "destructive" }),
  };
}

function ProfileSection({ role }: { role?: UserRole }) {
  const { user } = useAuth();
  const t = useSaveToast();
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  useEffect(() => {
    setFirst(user?.firstName ?? "");
    setLast(user?.lastName ?? "");
  }, [user?.firstName, user?.lastName]);
  const dirty = first.trim() !== (user?.firstName ?? "") || last.trim() !== (user?.lastName ?? "");

  const save = useMutation({
    mutationFn: async () => apiRequest("PATCH", "/api/me", { firstName: first.trim(), lastName: last.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      t.ok("Profile saved");
    },
    onError: t.fail,
  });

  const initials = `${(first || user?.email || "U")[0]}${last[0] ?? ""}`.toUpperCase();
  const roleLabel = role?.isSuperAdmin ? "Super admin" : role?.role === "admin" ? "Firm admin" : "Member";

  return (
    <Section
      id="profile"
      title="Profile"
      description="How you appear to your team."
      footer={
        <Button onClick={() => save.mutate()} disabled={!dirty || !first.trim() || save.isPending} data-testid="button-save-profile">
          {save.isPending ? "Saving…" : "Save profile"}
        </Button>
      }
    >
      <div className="flex flex-col gap-6 sm:flex-row">
        <div className="flex items-center gap-4 sm:w-56 sm:flex-col sm:items-start">
          <Avatar className="h-16 w-16">
            <AvatarImage src={user?.profileImageUrl || undefined} />
            <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-semibold" data-testid="text-user-name">
              {[user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email}
            </p>
            <p className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
              {role?.isSuperAdmin && <Shield className="h-3 w-3" />}
              {roleLabel}
            </p>
          </div>
        </div>
        <div className="grid flex-1 gap-4 sm:grid-cols-2">
          <Field label="First name">
            <Input value={first} onChange={(e) => setFirst(e.target.value)} maxLength={80} data-testid="input-first-name" />
          </Field>
          <Field label="Last name">
            <Input value={last} onChange={(e) => setLast(e.target.value)} maxLength={80} data-testid="input-last-name" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Email" hint="used to sign in">
              <div className="flex h-9 items-center gap-2 rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground">
                <Mail className="h-4 w-4 shrink-0" />
                <span className="truncate" data-testid="text-user-email">{user?.email}</span>
              </div>
            </Field>
          </div>
        </div>
      </div>
    </Section>
  );
}

function FirmSection({ role }: { role?: UserRole }) {
  const t = useSaveToast();
  const { data } = useQuery<{ client: { name: string; address: string | null; phone: string | null } }>({
    queryKey: ["/api/client/info"],
  });
  const canEdit = !!role?.isSuperAdmin || role?.role === "admin";
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  useEffect(() => {
    if (!data?.client) return;
    setName(data.client.name ?? "");
    setAddress(data.client.address ?? "");
    setPhone(data.client.phone ?? "");
  }, [data]);
  const c = data?.client;
  const dirty = !!c && (name.trim() !== c.name || address.trim() !== (c.address ?? "") || phone.trim() !== (c.phone ?? ""));

  const save = useMutation({
    mutationFn: async () => apiRequest("PATCH", "/api/client/info", { name: name.trim(), address: address.trim(), phone: phone.trim() }),
    onSuccess: () => {
      for (const k of ["/api/client/info", "/api/user/role", "/api/onboarding"]) queryClient.invalidateQueries({ queryKey: [k] });
      t.ok("Firm details saved");
    },
    onError: t.fail,
  });

  return (
    <Section
      id="firm"
      title="Firm"
      description={canEdit ? "Shown on your Today page and client portals." : "Only your firm's admins can change these."}
      footer={
        canEdit ? (
          <Button onClick={() => save.mutate()} disabled={!dirty || !name.trim() || save.isPending} data-testid="button-save-firm">
            {save.isPending ? "Saving…" : "Save firm details"}
          </Button>
        ) : undefined
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Firm name">
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} maxLength={160} data-testid="input-firm-name" />
          </Field>
        </div>
        <Field label="Address">
          <Input value={address} onChange={(e) => setAddress(e.target.value)} disabled={!canEdit} maxLength={300} placeholder="e.g. 1101 K St NW, Washington, DC" />
        </Field>
        <Field label="Phone">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} disabled={!canEdit} maxLength={40} placeholder="e.g. (202) 555-0100" />
        </Field>
      </div>
    </Section>
  );
}

// The onboarding answers at a glance, with the Today switches inline.
function PracticeSection() {
  const { data: setup } = useFirmSetup();
  const t = useSaveToast();
  const save = useMutation({
    mutationFn: async (onboarding: FirmOnboarding) => apiRequest("PUT", "/api/onboarding/firm", { onboarding }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding"] });
      t.ok("Saved. Today is updated.");
    },
    onError: t.fail,
  });
  if (!setup) return null;
  const p = setup.profile;
  const o = p?.onboarding ?? {};

  const summary: Array<{ label: string; values: string[]; step: string }> = [
    { label: "Policy areas", values: p?.industries ?? [], step: "focus" },
    { label: "Issues you watch", values: p?.watchlistTopics ?? [], step: "focus" },
    { label: "Agencies", values: (p?.relevantAgencies ?? []).map((a) => AGENCIES.find((x) => x.value === a)?.label ?? a), step: "agencies" },
    { label: "Committees", values: p?.relevantCommittees ?? [], step: "agencies" },
    { label: "States", values: p?.states ?? [], step: "states" },
    { label: "Clients", values: setup.clients.map((c) => c.name), step: "clients" },
  ];

  const Segmented = <T extends string>({ value, options, onPick, testId }: { value?: T; options: Array<{ value: T; label: string }>; onPick: (v: T) => void; testId: string }) => (
    <div className="inline-flex rounded-lg border bg-muted/40 p-0.5" role="radiogroup" data-testid={testId}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          disabled={save.isPending}
          onClick={() => onPick(opt.value)}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
            value === opt.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );

  return (
    <Section
      id="practice"
      title="Practice & Today"
      description={setup.onboarded ? "What your Today page, news ranking and answers are built from." : "Not set up yet. About ten minutes."}
      footer={
        <>
          <Button asChild variant="outline">
            <Link href="/onboarding?step=clients">Manage clients</Link>
          </Button>
          <Button asChild>
            <Link href="/onboarding">{setup.onboarded ? "Edit all answers" : "Start setup"}</Link>
          </Button>
        </>
      }
    >
      <dl className="divide-y">
        {summary.map((row) => (
          <div key={row.label} className="flex items-start gap-4 py-2.5 first:pt-0">
            <dt className="w-36 shrink-0 text-sm font-medium">{row.label}</dt>
            <dd className="flex min-w-0 flex-1 flex-wrap gap-1.5">
              {row.values.length ? (
                row.values.slice(0, 10).map((v) => (
                  <span key={v} className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
                    {v}
                  </span>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">None yet</span>
              )}
              {row.values.length > 10 && <span className="text-xs text-muted-foreground">+{row.values.length - 10} more</span>}
            </dd>
            <Link href={`/onboarding?step=${row.step}`} className="shrink-0 text-sm font-semibold text-primary hover:underline">
              Edit
            </Link>
          </div>
        ))}
      </dl>

      <div className="mt-5 space-y-3 rounded-lg border bg-muted/20 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">On your Today page</p>
        <Row label="Weather alerts" hint="Storms, fires and disaster declarations. The D.C. forecast always shows.">
          <Segmented
            value={o.weather ?? "often"}
            options={WEATHER_IMPACT.map((w) => ({ value: w.value, label: w.value === "often" ? "Top" : w.value === "sometimes" ? "Lower" : "Off" }))}
            onPick={(weather) => save.mutate({ weather })}
            testId="toggle-weather"
          />
        </Row>
        <Row label="Prediction markets" hint="Kalshi odds on elections and policy outcomes.">
          <Segmented
            value={!o.markets || o.markets === "yes" ? "yes" : "no"}
            options={[
              { value: "yes" as const, label: "Show" },
              { value: "no" as const, label: "Hide" },
            ]}
            onPick={(v) => save.mutate({ markets: v === "yes" ? "yes" : "sometimes" })}
            testId="toggle-markets"
          />
        </Row>
        <Row label="Shortcuts" hint="Pin favorite pages under Should I be worried?">
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard">Customize on Today</Link>
          </Button>
        </Row>
      </div>
    </Section>
  );
}

function InviteSection() {
  const { toast } = useToast();
  const url = `${window.location.origin}/signup`;
  return (
    <Section
      id="team"
      title="Sign-up link"
      description="For someone who wants their own firm account: signing up creates a new firm. To add a colleague to your firm, email support@governmentaffairs.io."
    >
      <div className="flex items-center gap-2">
        <Input readOnly value={url} className="text-sm" data-testid="input-signup-link" />
        <Button
          variant="outline"
          className="shrink-0"
          data-testid="button-copy-signup-link"
          onClick={() =>
            navigator.clipboard
              .writeText(url)
              .then(() => toast({ title: "Link copied" }))
              .catch(() => toast({ title: "Copy failed", description: "Select and copy the link instead.", variant: "destructive" }))
          }
        >
          <Copy className="h-4 w-4" /> Copy
        </Button>
      </div>
    </Section>
  );
}

function IntegrationsSection() {
  const { user } = useAuth();
  const [location] = useLocation();
  const { toast } = useToast();
  const { data: miro } = useQuery<MiroStatus>({ queryKey: ["/api/miro/status"], enabled: !!user });
  const connect = useMutation({
    mutationFn: async () => (await apiRequest("GET", "/api/miro/auth")).json(),
    onSuccess: (d: { authUrl: string }) => {
      window.location.href = d.authUrl;
    },
    onError: (err: Error) => toast({ title: "Couldn't start Miro", description: friendlyError(err), variant: "destructive" }),
  });

  // Result of the Miro OAuth round trip.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const r = params.get("miro");
    if (r === "success") {
      toast({ title: "Miro connected" });
      queryClient.invalidateQueries({ queryKey: ["/api/miro/status"] });
    } else if (r === "error") {
      toast({ title: "Couldn't connect Miro", description: params.get("message") || undefined, variant: "destructive" });
    }
    if (r) window.history.replaceState({}, "", "/settings");
  }, [location, toast]);

  return (
    <Section id="integrations" title="Integrations" description="Connected services.">
      <Row label="Miro" hint={miro?.connected ? `Connected${miro.user?.name ? ` as ${miro.user.name}` : ""}` : "Draw staff and influence maps on a Miro board"}>
        {miro?.connected ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
            <CheckCircle2 className="h-3.5 w-3.5" /> Connected
          </span>
        ) : miro?.hasCredentials ? (
          <Button size="sm" onClick={() => connect.mutate()} disabled={connect.isPending} data-testid="button-connect-miro">
            {connect.isPending ? "Connecting…" : "Connect"} <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">Not available yet</span>
        )}
      </Row>
    </Section>
  );
}

function AccountSection() {
  const { logout, isLoggingOut } = useAuth();
  return (
    <Section id="account" title="Account">
      <Row label="Sign out" hint="Sign out of GovernmentAffairs.io on this device.">
        <Button variant="outline" onClick={() => logout()} disabled={isLoggingOut} data-testid="button-logout">
          {isLoggingOut ? "Signing out…" : "Sign out"}
        </Button>
      </Row>
    </Section>
  );
}
