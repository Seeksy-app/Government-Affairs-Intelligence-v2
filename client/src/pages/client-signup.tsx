import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Building2, ArrowLeft, ArrowRight, Mail, Users, Target, Megaphone, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const signupSchema = z.object({
  // Step 1: Basic Info
  companyName: z.string().min(2, "Company name is required"),
  contactName: z.string().min(2, "Your name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional(),
  // Step 2: About Your Firm
  firmSize: z.string().optional(),
  industry: z.string().optional(),
  website: z.string().optional(),
  // Step 3: Your Goals
  primaryGoals: z.array(z.string()).optional(),
  currentTools: z.string().optional(),
  expectedUsers: z.string().optional(),
  // Step 4: How Did You Hear About Us
  howHeardAboutUs: z.string().optional(),
  referralSource: z.string().optional(),
  urgency: z.string().optional(),
  message: z.string().optional(),
});

type SignupForm = z.infer<typeof signupSchema>;

const STEPS = [
  { id: 1, title: "Your Info", icon: Building2 },
  { id: 2, title: "About Your Firm", icon: Users },
  { id: 3, title: "Your Goals", icon: Target },
  { id: 4, title: "Final Details", icon: Megaphone },
];

const GOAL_OPTIONS = [
  { id: "legislation_tracking", label: "Track legislation & bills" },
  { id: "contact_management", label: "Manage political contacts" },
  { id: "research", label: "AI-powered research" },
  { id: "news_monitoring", label: "Monitor political news" },
  { id: "network_mapping", label: "Map relationships & networks" },
  { id: "client_management", label: "Manage sub-clients/matters" },
];

const FIRM_SIZE_OPTIONS = [
  { value: "1-5", label: "1-5 people" },
  { value: "6-20", label: "6-20 people" },
  { value: "21-50", label: "21-50 people" },
  { value: "51-100", label: "51-100 people" },
  { value: "100+", label: "100+ people" },
];

const HEARD_ABOUT_OPTIONS = [
  { value: "referral", label: "Referral from a colleague" },
  { value: "search", label: "Google search" },
  { value: "conference", label: "Conference or event" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "twitter", label: "Twitter/X" },
  { value: "advertisement", label: "Advertisement" },
  { value: "other", label: "Other" },
];

const URGENCY_OPTIONS = [
  { value: "immediate", label: "Ready to start immediately" },
  { value: "within_month", label: "Within the next month" },
  { value: "exploring", label: "Just exploring options" },
];

export default function ClientSignupPage() {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");

  const form = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      companyName: "",
      contactName: "",
      email: "",
      phone: "",
      firmSize: "",
      industry: "",
      website: "",
      primaryGoals: [],
      currentTools: "",
      expectedUsers: "",
      howHeardAboutUs: "",
      referralSource: "",
      urgency: "",
      message: "",
    },
  });

  const signupMutation = useMutation({
    mutationFn: async (data: SignupForm) => {
      const res = await apiRequest("POST", "/api/client-applications", data);
      return res.json();
    },
    onSuccess: (_, variables) => {
      setSubmittedEmail(variables.email);
      setSubmitted(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Signup Failed",
        description: error.message || "Failed to submit application",
        variant: "destructive",
      });
    },
  });

  const validateStep = async (currentStep: number): Promise<boolean> => {
    let fieldsToValidate: (keyof SignupForm)[] = [];
    
    switch (currentStep) {
      case 1:
        fieldsToValidate = ["companyName", "contactName", "email"];
        break;
      case 2:
        fieldsToValidate = [];
        break;
      case 3:
        fieldsToValidate = [];
        break;
      case 4:
        fieldsToValidate = [];
        break;
    }

    const result = await form.trigger(fieldsToValidate);
    return result;
  };

  const nextStep = async () => {
    const isValid = await validateStep(step);
    if (isValid && step < 4) {
      setStep(step + 1);
    }
  };

  const prevStep = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const onSubmit = (data: SignupForm) => {
    signupMutation.mutate(data);
  };

  const toggleGoal = (goalId: string) => {
    const currentGoals = form.getValues("primaryGoals") || [];
    if (currentGoals.includes(goalId)) {
      form.setValue("primaryGoals", currentGoals.filter(g => g !== goalId));
    } else {
      form.setValue("primaryGoals", [...currentGoals, goalId]);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
              <Mail className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle>Check Your Email</CardTitle>
            <CardDescription>
              We've sent a verification link to <strong>{submittedEmail}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              Please click the link in your email to verify your account. After verification, 
              our team will review your application and you'll receive an approval notification.
            </p>
            <div className="pt-4">
              <Link href="/">
                <Button variant="outline">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Home
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Create Your Account</CardTitle>
          <CardDescription>
            Tell us about your firm to get started
          </CardDescription>
        </CardHeader>

        {/* Progress Steps */}
        <div className="px-6 pb-4">
          <div className="flex items-center justify-between">
            {STEPS.map((s, index) => (
              <div key={s.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors",
                      step === s.id
                        ? "border-primary bg-primary text-primary-foreground"
                        : step > s.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-muted-foreground/30 text-muted-foreground"
                    )}
                  >
                    {step > s.id ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <s.icon className="w-5 h-5" />
                    )}
                  </div>
                  <span className={cn(
                    "text-xs mt-1 hidden sm:block",
                    step >= s.id ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {s.title}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={cn(
                      "h-0.5 w-8 sm:w-16 mx-2",
                      step > s.id ? "bg-primary" : "bg-muted-foreground/30"
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              {/* Step 1: Basic Info */}
              {step === 1 && (
                <div className="space-y-4">
                  <h3 className="font-medium text-lg">Welcome! Let's get started.</h3>
                  <p className="text-sm text-muted-foreground">Tell us a bit about yourself.</p>
                  
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="companyName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="Your Consulting Firm" {...field} data-testid="input-company-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="contactName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Your Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="John Smith" {...field} data-testid="input-contact-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Work Email *</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="you@company.com" {...field} data-testid="input-email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="(555) 123-4567" {...field} data-testid="input-phone" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}

              {/* Step 2: About Your Firm */}
              {step === 2 && (
                <div className="space-y-4">
                  <h3 className="font-medium text-lg">Tell us about your firm</h3>
                  <p className="text-sm text-muted-foreground">Help us understand your organization better.</p>
                  
                  <FormField
                    control={form.control}
                    name="firmSize"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>How many people are in your firm?</FormLabel>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {FIRM_SIZE_OPTIONS.map((option) => (
                            <Button
                              key={option.value}
                              type="button"
                              variant={field.value === option.value ? "default" : "outline"}
                              className="justify-start"
                              onClick={() => form.setValue("firmSize", option.value)}
                              data-testid={`button-firm-size-${option.value}`}
                            >
                              {option.label}
                            </Button>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="industry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Industry Focus (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Healthcare, Energy, Technology" {...field} data-testid="input-industry" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="website"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Website (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="https://yourcompany.com" {...field} data-testid="input-website" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Step 3: Your Goals */}
              {step === 3 && (
                <div className="space-y-4">
                  <h3 className="font-medium text-lg">What are you looking to do?</h3>
                  <p className="text-sm text-muted-foreground">Select all that apply to help us tailor your experience.</p>
                  
                  <FormField
                    control={form.control}
                    name="primaryGoals"
                    render={({ field }) => (
                      <FormItem>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {GOAL_OPTIONS.map((goal) => {
                            const currentGoals = field.value || [];
                            const isSelected = currentGoals.includes(goal.id);
                            return (
                              <div
                                key={goal.id}
                                className={cn(
                                  "flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors",
                                  isSelected
                                    ? "border-primary bg-primary/5"
                                    : "border-border hover-elevate"
                                )}
                                onClick={() => toggleGoal(goal.id)}
                                data-testid={`goal-${goal.id}`}
                              >
                                <div className={cn(
                                  "h-4 w-4 shrink-0 rounded-sm border flex items-center justify-center",
                                  isSelected 
                                    ? "bg-primary border-primary text-primary-foreground" 
                                    : "border-primary"
                                )}>
                                  {isSelected && <CheckCircle2 className="h-3 w-3" />}
                                </div>
                                <span className="text-sm">{goal.label}</span>
                              </div>
                            );
                          })}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="currentTools"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>What tools do you currently use? (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Quorum, Bloomberg Gov, spreadsheets..." {...field} data-testid="input-current-tools" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="expectedUsers"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>How many team members will use this platform? (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., 5-10" {...field} data-testid="input-expected-users" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Step 4: Final Details */}
              {step === 4 && (
                <div className="space-y-4">
                  <h3 className="font-medium text-lg">Almost done!</h3>
                  <p className="text-sm text-muted-foreground">Just a few more questions.</p>
                  
                  <FormField
                    control={form.control}
                    name="howHeardAboutUs"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>How did you hear about us?</FormLabel>
                        <div className="grid grid-cols-2 gap-2">
                          {HEARD_ABOUT_OPTIONS.map((option) => (
                            <Button
                              key={option.value}
                              type="button"
                              variant={field.value === option.value ? "default" : "outline"}
                              className="justify-start text-left h-auto py-2"
                              onClick={() => form.setValue("howHeardAboutUs", option.value)}
                              data-testid={`button-heard-${option.value}`}
                            >
                              {option.label}
                            </Button>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {form.watch("howHeardAboutUs") === "referral" && (
                    <FormField
                      control={form.control}
                      name="referralSource"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Who referred you? (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="Name or company" {...field} data-testid="input-referral-source" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="urgency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>When are you looking to get started?</FormLabel>
                        <div className="grid gap-2">
                          {URGENCY_OPTIONS.map((option) => (
                            <Button
                              key={option.value}
                              type="button"
                              variant={field.value === option.value ? "default" : "outline"}
                              className="justify-start"
                              onClick={() => form.setValue("urgency", option.value)}
                              data-testid={`button-urgency-${option.value}`}
                            >
                              {option.label}
                            </Button>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Anything else you'd like us to know? (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Additional context or questions..." {...field} data-testid="input-message" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between pt-4 border-t">
                <div>
                  {step > 1 ? (
                    <Button type="button" variant="ghost" onClick={prevStep} data-testid="button-back">
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back
                    </Button>
                  ) : (
                    <Link href="/">
                      <Button type="button" variant="ghost" data-testid="button-cancel">
                        Cancel
                      </Button>
                    </Link>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    Step {step} of 4
                  </span>
                  {step < 4 ? (
                    <Button type="button" onClick={nextStep} data-testid="button-next">
                      Next
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  ) : (
                    <Button type="submit" disabled={signupMutation.isPending} data-testid="button-submit">
                      {signupMutation.isPending ? "Submitting..." : "Submit Application"}
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </Form>

          {/* Already have an account */}
          <div className="text-center text-sm text-muted-foreground pt-6">
            Already have an account?{" "}
            <a href="/api/login" className="text-primary hover:underline">
              Sign in
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
