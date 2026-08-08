import { useTranslation } from "react-i18next";
import { ArrowLeft, ChevronLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageLoadingSkeleton } from "@/components/PageLoadingSkeleton";

// Small composable pieces shared by the detail pages (story, issue, author…).
// Each page keeps its own layout; these only capture the three states every
// page repeats: going back, loading, and "this code does not exist".

interface DetailBackButtonProps {
  onClick: () => void;
  /**
   * "labeled" is the outline "← Back" button most pages use; "icon" is the
   * square chevron-only ghost button of the publication/publisher pages.
   */
  appearance?: "labeled" | "icon";
}

export function DetailBackButton({ onClick, appearance = "labeled" }: DetailBackButtonProps) {
  const { t } = useTranslation();

  if (appearance === "icon") {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={onClick}
        className="h-9 w-9 rounded-xl border border-border-subtle hover:bg-surface-2"
      >
        <ChevronLeft className="w-5 h-5" />
      </Button>
    );
  }

  return (
    <Button onClick={onClick} variant="outline" size="sm" className="rounded-xl gap-1.5 h-9">
      <ArrowLeft className="w-4 h-4" />
      {t("common.back")}
    </Button>
  );
}

interface DetailLoadingProps {
  /** "skeleton" mirrors PageLoadingSkeleton; "spinner" is the centered loader. */
  variant?: "skeleton" | "spinner";
}

export function DetailLoading({ variant = "skeleton" }: DetailLoadingProps) {
  if (variant === "spinner") {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  return <PageLoadingSkeleton />;
}

interface DetailNotFoundProps {
  /** Already-translated message; the pages own their i18n keys. */
  message: string;
  /** When provided, renders the "← Back" escape hatch under the message. */
  onBack?: () => void;
}

export function DetailNotFound({ message, onBack }: DetailNotFoundProps) {
  const { t } = useTranslation();
  return (
    <div className="p-8 text-center text-muted-foreground">
      <p>{message}</p>
      {onBack && (
        <Button onClick={onBack} variant="outline" className="mt-4 gap-2 rounded-xl">
          <ArrowLeft className="w-4 h-4" />
          {t("common.back")}
        </Button>
      )}
    </div>
  );
}
