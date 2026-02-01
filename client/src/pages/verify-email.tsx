import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, ArrowLeft, ArrowRight } from "lucide-react";

export default function VerifyEmailPage() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [setupToken, setSetupToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (!token) {
      setStatus("error");
      setMessage("Invalid verification link. No token provided.");
      return;
    }

    fetch(`/api/client-applications/verify?token=${token}`)
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          setStatus("success");
          setMessage(data.message || "Your email has been verified successfully.");
          if (data.setupToken) {
            setSetupToken(data.setupToken);
            setEmail(data.email);
          }
        } else {
          setStatus("error");
          setMessage(data.message || "Verification failed.");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("An error occurred during verification.");
      });
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {status === "loading" && (
            <>
              <div className="mx-auto w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-4">
                <Loader2 className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-spin" />
              </div>
              <CardTitle>Verifying Email</CardTitle>
              <CardDescription>Please wait while we verify your email...</CardDescription>
            </>
          )}
          {status === "success" && (
            <>
              <div className="mx-auto w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle>Email Verified!</CardTitle>
              <CardDescription>{message}</CardDescription>
            </>
          )}
          {status === "error" && (
            <>
              <div className="mx-auto w-12 h-12 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mb-4">
                <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <CardTitle>Verification Failed</CardTitle>
              <CardDescription>{message}</CardDescription>
            </>
          )}
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {status === "success" && setupToken && (
            <>
              <p className="text-sm text-muted-foreground">
                Your email has been verified! Now let's set up your password to secure your account.
              </p>
              <div className="pt-4">
                <Button
                  onClick={() => setLocation(`/set-password?token=${setupToken}&email=${encodeURIComponent(email || "")}`)}
                  data-testid="button-set-password"
                >
                  Set Up Password
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </>
          )}
          {status === "success" && !setupToken && (
            <>
              <p className="text-sm text-muted-foreground">
                Your email has been verified. You can now log in to your account.
              </p>
              <div className="pt-4">
                <Link href="/login">
                  <Button data-testid="button-go-login">
                    Go to Login
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </>
          )}
          {status === "error" && (
            <p className="text-sm text-muted-foreground">
              If you believe this is an error, please try signing up again or contact support.
            </p>
          )}
          {status === "error" && (
            <div className="pt-4">
              <Link href="/">
                <Button variant="outline">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Home
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
