import { useState } from "react";
import { useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { GaMark } from "@/components/ga-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface InviteInfo {
  firmName: string;
  email: string;
  role: "member" | "admin";
  inviterName: string | null;
  needsSignIn: boolean;
  signedInAs: string | null;
}

// Public page behind the emailed invite link: set a name and password (or,
// for an existing account, confirm while signed in) and land in the firm.
export default function AcceptInvitePage() {
  const token = new URLSearchParams(useSearch()).get("token") ?? "";
  const { data, error, isLoading } = useQuery<InviteInfo>({
    queryKey: ["/api/invites", token],
    queryFn: async () => {
      const res = await fetch(`/api/invites/${encodeURIComponent(token)}`, { credentials: "include" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message ?? "This invite link isn't valid.");
      return body;
    },
    enabled: !!token,
    retry: false,
  });

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const signedInAsInvitee = !!data?.signedInAs && data.signedInAs.toLowerCase() === data.email.toLowerCase();

  const accept = async () => {
    setProblem(null);
    if (!data?.needsSignIn) {
      if (!firstName.trim()) return setProblem("Add your first name.");
      if (password.length < 8) return setProblem("Use a password of at least 8 characters.");
      if (password !== confirm) return setProblem("The passwords don't match.");
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/invites/${encodeURIComponent(token)}/accept`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data?.needsSignIn ? {} : { firstName, lastName, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message ?? "Couldn't accept the invite.");
      window.location.href = "/dashboard"; // full reload so the app picks up the new session
    } catch (err) {
      setProblem((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F6F2] px-4 py-10 dark:bg-background">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <GaMark size={36} />
          <span className="text-lg font-semibold tracking-tight">GovernmentAffairs.io</span>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm sm:p-8" data-testid="card-accept-invite">
          {!token || error ? (
            <>
              <h1 className="text-xl font-semibold tracking-tight">This invite link isn't working</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {(error as Error)?.message ?? "The link is incomplete."} Ask whoever invited you to send a new one.
              </p>
              <Button asChild variant="outline" className="mt-6 w-full">
                <a href="/login">Go to sign in</a>
              </Button>
            </>
          ) : isLoading || !data ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#078ACB]">Team invite</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">Join {data.firmName}</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {data.inviterName ? `${data.inviterName} invited you` : "You've been invited"} as{" "}
                {data.role === "admin" ? "an admin" : "a member"}. You'll sign in as <strong className="text-foreground">{data.email}</strong>.
              </p>

              {data.needsSignIn && !signedInAsInvitee ? (
                <div className="mt-6 space-y-3">
                  <p className="text-sm">
                    You already have an account. Sign in as <strong>{data.email}</strong>, then open this invite link again.
                  </p>
                  <Button asChild className="w-full">
                    <a href="/login">Sign in</a>
                  </Button>
                </div>
              ) : (
                <form
                  className="mt-6 space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    accept();
                  }}
                >
                  {!data.needsSignIn && (
                    <>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block text-sm font-medium">
                          First name
                          <Input className="mt-1.5" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" autoFocus data-testid="input-invite-first" />
                        </label>
                        <label className="block text-sm font-medium">
                          Last name
                          <Input className="mt-1.5" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" data-testid="input-invite-last" />
                        </label>
                      </div>
                      <label className="block text-sm font-medium">
                        Password
                        <Input className="mt-1.5" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" data-testid="input-invite-password" />
                        <span className="mt-1 block text-xs font-normal text-muted-foreground">At least 8 characters.</span>
                      </label>
                      <label className="block text-sm font-medium">
                        Confirm password
                        <Input className="mt-1.5" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" data-testid="input-invite-confirm" />
                      </label>
                    </>
                  )}
                  {problem && <p className="text-sm font-medium text-[#A53B39]">{problem}</p>}
                  <Button type="submit" className="w-full" disabled={busy} data-testid="button-accept-invite">
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                    Join {data.firmName}
                  </Button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
