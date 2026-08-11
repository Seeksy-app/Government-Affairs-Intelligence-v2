import { useState } from "react";
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

// GovernmentAffairs.co lockup — GA mark + wordmark (brand: Source Sans 3, ExtraBold)
function Wordmark({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="grid h-9 w-9 place-items-center rounded-[5px] bg-[#078ACB] font-extrabold tracking-tight text-white">
        GA
      </div>
      <span className="text-lg font-extrabold tracking-tight">
        GovernmentAffairs<span className="text-[#078ACB]">.co</span>
      </span>
    </div>
  );
}

export default function LoginPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [showPassword, setShowPassword] = useState(false);

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

  return (
    <div
      className="min-h-screen w-full bg-[#F7F6F2] text-[#14253D] md:grid md:grid-cols-[1.05fr_1fr]"
      style={{ fontFamily: "'Source Sans 3', ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Left — Capitol Navy brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[#14253D] p-12 text-[#F7F6F2] md:flex lg:p-16">
        {/* restrained architectural column motif */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, #F7F6F2 0, #F7F6F2 2px, transparent 2px, transparent 48px)",
          }}
        />

        <Wordmark className="relative" />

        <div className="relative max-w-md">
          <p className="mb-5 text-xs font-extrabold uppercase tracking-[0.18em] text-[#078ACB]">
            Early access — Invite only
          </p>
          <h1
            className="text-4xl font-[650] leading-[1.08] lg:text-[2.9rem]"
            style={{ letterSpacing: "-0.04em" }}
          >
            Find the path to the people who shape policy.
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed text-[#C9D2DE]">
            Map the staff, brief the topics, and find the fastest route to the
            offices behind every bill, hearing, and grant award.
          </p>
        </div>

        <div className="relative">
          <div className="mb-4 h-px w-12 bg-[#078ACB]" />
          <p className="text-[13px] font-semibold tracking-wide text-[#9FB0C4]">
            Staff intelligence · Legislative monitoring · Relationship mapping
          </p>
        </div>
      </div>

      {/* Right — sign-in form on Paper */}
      <div className="flex min-h-screen items-center justify-center px-6 py-12">
        <div className="w-full max-w-[400px]">
          <Wordmark className="mb-10 md:hidden" />

          <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.18em] text-[#078ACB]">
            Sign in
          </p>
          <h2 className="text-[1.75rem] font-[650] text-[#14253D]" style={{ letterSpacing: "-0.04em" }}>
            Welcome back
          </h2>
          <p className="mb-8 mt-1.5 text-[15px] text-[#5A6B80]">
            Sign in to your GovernmentAffairs.co account.
          </p>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px] font-bold text-[#14253D]">Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="you@yourfirm.com"
                        data-testid="input-email"
                        className="h-11 rounded-[5px] border-[#E9ECEC] bg-white text-[#14253D] focus-visible:border-[#078ACB] focus-visible:ring-[#078ACB]/30"
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
                      <FormLabel className="text-[13px] font-bold text-[#14253D]">Password</FormLabel>
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
                          className="h-11 rounded-[5px] border-[#E9ECEC] bg-white pr-11 text-[#14253D] focus-visible:border-[#078ACB] focus-visible:ring-[#078ACB]/30"
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          data-testid="button-toggle-password"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          className="absolute right-0 top-0 grid h-11 w-11 place-items-center text-[#5A6B80] transition-colors hover:text-[#14253D]"
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
                className="flex h-11 w-full items-center justify-center gap-2 rounded-[5px] bg-[#078ACB] font-bold text-white transition-colors hover:bg-[#0679b0] disabled:cursor-not-allowed disabled:opacity-60"
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

          <p className="mt-8 text-center text-[14px] text-[#5A6B80]">
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
