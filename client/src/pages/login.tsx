import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation, Link } from "wouter";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, ArrowRight } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

// Human-readable messages for /login?error=... set by the LinkedIn callback.
const LINKEDIN_ERRORS: Record<string, string> = {
  linkedin_unavailable: "LinkedIn sign-in isn't configured yet. Use your email and password.",
  linkedin_denied: "LinkedIn sign-in was cancelled.",
  linkedin_state: "LinkedIn sign-in expired — please try again.",
  linkedin_nocookie: "Sign-in blocked: your browser didn't send the session cookie back (code NC).",
  linkedin_nosession: "Sign-in blocked: session found but no sign-in state (code NS).",
  linkedin_no_email: "LinkedIn didn't share an email address. Use your email and password.",
  linkedin_session: "Signed in with LinkedIn, but the session couldn't be created. Please try again.",
  linkedin_failed: "LinkedIn sign-in failed. Please try again or use your email and password.",
};

// Rotating brand imagery for the sign-in panel — one shown at random per visit.
// Captions are placeholder copy; edit freely.
const PANELS = [
  { src: "/login/corridor.jpg", caption: "Where connection meets a sense of place." },
  { src: "/login/roundtable.jpg", caption: "A trusted introduction at the table." },
  { src: "/login/hotel-lobby.jpg", caption: "Warm, accessible, and credible." },
  { src: "/login/casual-bar.jpg", caption: "Relationships that develop naturally." },
  { src: "/login/coffee-meeting.jpg", caption: "Quiet, purposeful, human." },
];

// GovernmentAffairs.io lockup — GA mark + wordmark (brand: Source Sans 3, ExtraBold)
function Wordmark({ className = "", onDark = true }: { className?: string; onDark?: boolean }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div
        className={`grid h-10 w-10 place-items-center rounded-[6px] text-[15px] font-extrabold tracking-tight ${
          onDark ? "bg-white text-[#14253D]" : "bg-[#14253D] text-white"
        }`}
      >
        GA
      </div>
      <span className="text-xl font-extrabold tracking-tight">
        GovernmentAffairs<span className="text-[#078ACB]">.io</span>
      </span>
    </div>
  );
}

export default function LoginPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [panel] = useState(() => PANELS[Math.floor(Math.random() * PANELS.length)]);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginForm) => {
      const response = await apiRequest("POST", "/api/auth/login", data);
      return response.json();
    },
    onSuccess: async (data: { role: string }) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/user/role"] });

      toast({
        title: "Welcome back!",
        description: "You have been logged in successfully.",
      });

      if (data.role === "admin") {
        setLocation("/admin");
      } else {
        setLocation("/dashboard");
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message || "Invalid email or password",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: LoginForm) => {
    loginMutation.mutate(data);
  };

  // Surface LinkedIn callback errors (?error=linkedin_*) once, then clean the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err && LINKEDIN_ERRORS[err]) {
      toast({
        title: "LinkedIn sign-in",
        description: LINKEDIN_ERRORS[err],
        variant: "destructive",
      });
      window.history.replaceState({}, "", "/login");
    }
  }, [toast]);

  return (
    <div
      className="min-h-screen w-full bg-[#F7F6F2] text-[#14253D] md:grid md:grid-cols-[1.05fr_1fr]"
      style={{ fontFamily: "'Source Sans 3', ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Left — Capitol Navy brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[#14253D] p-12 text-[#F7F6F2] md:flex lg:p-16">
        {/* rotating brand photo + navy overlay for legibility */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url('${panel.src}')` }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(105deg, rgba(20,37,61,0.97) 0%, rgba(20,37,61,0.88) 42%, rgba(20,37,61,0.58) 100%)",
          }}
        />

        <Wordmark className="relative" />

        <div className="relative max-w-xl">
          <p className="mb-6 text-sm font-extrabold uppercase tracking-[0.2em] text-[#078ACB]">
            Early access — Invite only
          </p>
          <h1
            className="text-5xl font-[650] leading-[1.04] lg:text-[3.5rem]"
            style={{ letterSpacing: "-0.04em" }}
          >
            Find the path to the people who shape policy.
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-[#C9D2DE]">
            Map the staff, brief the topics, and find the fastest route to the
            offices behind every bill, hearing, and grant award.
          </p>
        </div>

        <div className="relative">
          <p className="mb-5 max-w-sm text-lg font-medium leading-snug text-[#F7F6F2]">
            {panel.caption}
          </p>
          <div className="mb-4 h-px w-12 bg-[#078ACB]" />
          <p className="text-[13px] font-semibold tracking-wide text-[#9FB0C4]">
            Staff intelligence · Legislative monitoring · Relationship mapping
          </p>
        </div>
      </div>

      {/* Right — sign-in form on Paper */}
      <div className="flex min-h-screen items-center justify-center px-6 py-12">
        <div className="w-full max-w-[400px]">
          <Wordmark className="mb-10 md:hidden" onDark={false} />

          <p className="mb-2 text-sm font-extrabold uppercase tracking-[0.2em] text-[#078ACB]">
            Sign in
          </p>
          <h2 className="text-[2.15rem] font-[650] text-[#14253D]" style={{ letterSpacing: "-0.04em" }}>
            Welcome back
          </h2>
          <p className="mb-8 mt-2 text-base text-[#5A6B80]">
            Sign in to your GovernmentAffairs.io account.
          </p>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-bold text-[#14253D]">Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="you@yourfirm.com"
                        data-testid="input-email"
                        className="h-12 rounded-[6px] border-[#E9ECEC] bg-white text-base text-[#14253D] focus-visible:border-[#078ACB] focus-visible:ring-[#078ACB]/30"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-sm font-bold text-[#14253D]">Password</FormLabel>
                      <Link
                        href="/forgot-password"
                        className="text-[13px] font-semibold text-[#078ACB] hover:underline"
                        data-testid="link-forgot-password"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Enter your password"
                          data-testid="input-password"
                          className="h-12 rounded-[6px] border-[#E9ECEC] bg-white text-base pr-11 text-[#14253D] focus-visible:border-[#078ACB] focus-visible:ring-[#078ACB]/30"
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          data-testid="button-toggle-password"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          className="absolute right-0 top-0 grid h-12 w-11 place-items-center text-[#5A6B80] transition-colors hover:text-[#14253D]"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <button
                type="submit"
                disabled={loginMutation.isPending}
                data-testid="button-login"
                className="flex h-12 w-full items-center justify-center gap-2 rounded-[6px] bg-[#078ACB] text-base font-bold text-white transition-colors hover:bg-[#0679b0] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loginMutation.isPending ? (
                  "Signing in…"
                ) : (
                  <>
                    Sign in
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          </Form>

          {/* Divider + LinkedIn SSO */}
          <div className="mt-6 flex items-center gap-3" aria-hidden>
            <div className="h-px flex-1 bg-[#E9ECEC]" />
            <span className="text-xs font-semibold uppercase tracking-wide text-[#5A6B80]">or</span>
            <div className="h-px flex-1 bg-[#E9ECEC]" />
          </div>

          <a
            href="/api/auth/linkedin"
            data-testid="button-linkedin-login"
            className="mt-6 flex h-12 w-full items-center justify-center gap-2.5 rounded-[6px] bg-[#0A66C2] text-base font-bold text-white transition-colors hover:bg-[#004182]"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden>
              <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.55C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.72C24 .77 23.2 0 22.22 0z" />
            </svg>
            Continue with LinkedIn
          </a>

          <p className="mt-8 text-center text-[15px] text-[#5A6B80]">
            Don&apos;t have an account yet?{" "}
            <a
              href="https://calendly.com/smartloads/gov-affairs-demo"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[#078ACB] hover:underline"
              data-testid="link-book-demo"
            >
              Book a demo
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
