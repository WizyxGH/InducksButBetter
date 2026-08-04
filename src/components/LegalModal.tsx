import { useState } from "react"
import { useTranslation } from "react-i18next"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export function LegalModal() {
  const [isOpen, setIsOpen] = useState(false)
  const { t } = useTranslation()

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button className="hover:text-foreground transition-colors underline underline-offset-2 opacity-70 hover:opacity-100">
          {t('legal.link')}
        </button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md rounded-xl">
        <DialogHeader>
          <DialogTitle>{t('legal.title')}</DialogTitle>
          <DialogDescription className="pt-4 space-y-4 text-sm text-foreground" asChild>
            <div>
              <p>
                {t('legal.content')}
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  )
}
