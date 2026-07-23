import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LibraryBig, Database, Bookmark, ChevronRight, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const ONBOARDING_KEY = "inducks_onboarding_completed";

export function OnboardingModal() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    // Only show if the user hasn't completed it yet
    const hasCompleted = localStorage.getItem(ONBOARDING_KEY);
    if (!hasCompleted) {
      // Slight delay for a smoother entry
      const timer = setTimeout(() => setOpen(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    setOpen(false);
  };

  const steps = [
    {
      title: t("onboarding.step1.title", "Explorez la base de données Inducks"),
      desc: t("onboarding.step1.desc", "Recherchez parmi des milliers d'histoires, explorez les publications par pays, et découvrez les fiches de vos auteurs et personnages Disney favoris."),
      icon: LibraryBig,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      title: t("onboarding.step2.title", "Consultation hors-ligne"),
      desc: t("onboarding.step2.desc", "InducksButBetter utilise une base de données locale. Plus d'attente et aucune connexion requise ! Vous pouvez mettre à jour cette base à tout moment depuis les paramètres."),
      icon: Database,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      title: t("onboarding.step3.title", "Votre collection"),
      desc: t("onboarding.step3.desc", "Ajoutez les bandes dessinées que vous possédez à votre collection personnelle pour pouvoir filtrer vos recherches par la suite."),
      icon: Bookmark,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
    },
  ];

  const currentStep = steps[step];
  const Icon = currentStep.icon;

  const nextStep = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      handleClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) handleClose();
    }}>
      <DialogContent className="sm:max-w-[425px] overflow-hidden p-0 border-border-subtle gap-0">
        <div className="p-6 pt-10 pb-8 flex flex-col items-center text-center relative overflow-hidden">
          {/* Decorative background blur */}
          <div className={cn("absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 blur-3xl opacity-30 transition-colors duration-500 rounded-full", currentStep.bg)} />
          
          <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center mb-6 relative z-10 transition-colors duration-500 shadow-sm border border-border-subtle", currentStep.bg)}>
            <Icon className={cn("w-8 h-8", currentStep.color)} />
          </div>
          
          <DialogHeader className="space-y-3 z-10 w-full px-2">
            <DialogTitle className="text-xl font-bold tracking-tight text-center">
              {currentStep.title}
            </DialogTitle>
            <DialogDescription className="text-[15px] leading-relaxed text-center text-text-secondary">
              {currentStep.desc}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 pb-6">
          {steps.map((_, i) => (
            <div 
              key={i} 
              className={cn(
                "h-1.5 rounded-full transition-all duration-300", 
                i === step ? "w-4 bg-primary" : "w-1.5 bg-primary/20"
              )} 
            />
          ))}
        </div>

        <DialogFooter className="p-4 bg-surface-2/50 border-t border-border-subtle sm:justify-between items-center gap-3">
          <Button variant="ghost" onClick={handleClose} className="text-muted-foreground hover:text-foreground">
            {t("common.skip", "Passer")}
          </Button>
          <Button onClick={nextStep} className="gap-2 min-w-[120px] rounded-full">
            {step < steps.length - 1 ? (
              <>
                {t("common.next", "Suivant")}
                <ChevronRight className="w-4 h-4" />
              </>
            ) : (
              <>
                {t("common.finish", "Terminer")}
                <Check className="w-4 h-4" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
