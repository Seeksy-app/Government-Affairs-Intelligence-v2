import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { X, ChevronRight, ChevronLeft, Sparkles } from "lucide-react";

interface TourStep {
  target: string;
  title: string;
  content: string;
  placement?: "top" | "bottom" | "left" | "right";
}

const TOUR_STEPS: TourStep[] = [
  {
    target: "[data-tour='dashboard']",
    title: "Welcome to Political Intel!",
    content: "This is your dashboard where you can see an overview of your contacts, matters, and recent activity. Let's take a quick tour of the key features.",
    placement: "bottom",
  },
  {
    target: "[data-tour='contacts']",
    title: "Contact Database",
    content: "Track political staffers, officials, and lobbyists. Add career histories to monitor their movements through government and private sector.",
    placement: "right",
  },
  {
    target: "[data-tour='matters']",
    title: "Matters & Projects",
    content: "Organize your research by client matters. Each matter can contain documents, AI conversations, and can be shared with your clients.",
    placement: "right",
  },
  {
    target: "[data-tour='ai-agent']",
    title: "AI Research Agent",
    content: "Extract content from websites, get YouTube transcripts, research people and organizations, or ask custom research questions. All powered by AI.",
    placement: "right",
  },
  {
    target: "[data-tour='portals']",
    title: "Client Portals",
    content: "Create custom portals to share specific research with your clients. They get a unique URL with read-only access to the matters you choose.",
    placement: "right",
  },
  {
    target: "[data-tour='kb']",
    title: "Knowledge Base",
    content: "Find guides and documentation here. We've prepared articles to help you get the most out of the platform.",
    placement: "right",
  },
];

const ADMIN_TOUR_STEPS: TourStep[] = [
  {
    target: "[data-tour='admin-dashboard']",
    title: "Admin Dashboard",
    content: "As a platform administrator, you can see statistics across all client organizations and manage the entire platform.",
    placement: "bottom",
  },
  {
    target: "[data-tour='admin-clients']",
    title: "Client Management",
    content: "Create and manage client organizations. Each client has their own isolated data, users, and settings.",
    placement: "right",
  },
  {
    target: "[data-tour='admin-security']",
    title: "Security Controls",
    content: "Configure platform-wide security levels (Basic, Standard, Enhanced, Enterprise) and manage security controls for compliance.",
    placement: "right",
  },
];

interface OnboardingTourProps {
  isAdmin?: boolean;
}

export function OnboardingTour({ isAdmin = false }: OnboardingTourProps) {
  const storageKey = isAdmin ? "political-intel-admin-tour-complete" : "political-intel-tour-complete";
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const steps = isAdmin ? ADMIN_TOUR_STEPS : TOUR_STEPS;

  useEffect(() => {
    const tourComplete = localStorage.getItem(storageKey);
    if (!tourComplete) {
      const timer = setTimeout(() => setIsOpen(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [storageKey]);

  const updateTargetPosition = useCallback(() => {
    if (!isOpen) return;
    const step = steps[currentStep];
    const target = document.querySelector(step.target);
    if (target) {
      setTargetRect(target.getBoundingClientRect());
    } else {
      setTargetRect(null);
    }
  }, [currentStep, isOpen, steps]);

  useEffect(() => {
    updateTargetPosition();
    window.addEventListener("resize", updateTargetPosition);
    window.addEventListener("scroll", updateTargetPosition);
    return () => {
      window.removeEventListener("resize", updateTargetPosition);
      window.removeEventListener("scroll", updateTargetPosition);
    };
  }, [updateTargetPosition]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem(storageKey, "true");
    setIsOpen(false);
  };

  const handleSkip = () => {
    localStorage.setItem(storageKey, "true");
    setIsOpen(false);
  };

  if (!isOpen) return null;

  const step = steps[currentStep];
  
  const getPopupPosition = () => {
    if (!targetRect) {
      return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
    }

    const popupWidth = 360;
    const popupHeight = 200;
    const offset = 16;

    switch (step.placement) {
      case "right":
        return {
          top: `${targetRect.top + targetRect.height / 2}px`,
          left: `${targetRect.right + offset}px`,
          transform: "translateY(-50%)",
        };
      case "left":
        return {
          top: `${targetRect.top + targetRect.height / 2}px`,
          left: `${targetRect.left - popupWidth - offset}px`,
          transform: "translateY(-50%)",
        };
      case "bottom":
        return {
          top: `${targetRect.bottom + offset}px`,
          left: `${targetRect.left + targetRect.width / 2}px`,
          transform: "translateX(-50%)",
        };
      case "top":
        return {
          top: `${targetRect.top - popupHeight - offset}px`,
          left: `${targetRect.left + targetRect.width / 2}px`,
          transform: "translateX(-50%)",
        };
      default:
        return {
          top: `${targetRect.bottom + offset}px`,
          left: `${targetRect.left}px`,
        };
    }
  };

  const popupStyle = getPopupPosition();

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/50 z-[9998]" 
        onClick={handleSkip}
        data-testid="onboarding-overlay"
      />
      
      {targetRect && (
        <div
          className="fixed z-[9999] rounded-md ring-4 ring-primary ring-offset-2 pointer-events-none"
          style={{
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
          }}
        />
      )}

      <Card
        className="fixed z-[10000] w-[360px] shadow-2xl"
        style={popupStyle as React.CSSProperties}
        data-testid="onboarding-popup"
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">{step.title}</CardTitle>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 -mr-2 -mt-2"
              onClick={handleSkip}
              data-testid="button-skip-tour"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <CardDescription className="text-xs">
            Step {currentStep + 1} of {steps.length}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{step.content}</p>
        </CardContent>
        <CardFooter className="flex justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrev}
            disabled={currentStep === 0}
            data-testid="button-prev-step"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <div className="flex gap-1">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full ${
                  i === currentStep ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>
          <Button
            size="sm"
            onClick={handleNext}
            data-testid="button-next-step"
          >
            {currentStep === steps.length - 1 ? "Finish" : "Next"}
            {currentStep < steps.length - 1 && <ChevronRight className="w-4 h-4 ml-1" />}
          </Button>
        </CardFooter>
      </Card>
    </>
  );
}

export function useResetOnboarding() {
  const resetTour = () => {
    localStorage.removeItem("political-intel-tour-complete");
    localStorage.removeItem("political-intel-admin-tour-complete");
    window.location.reload();
  };
  return { resetTour };
}
