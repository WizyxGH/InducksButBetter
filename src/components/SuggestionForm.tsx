import * as React from "react"
import { useTranslation } from "react-i18next"
import { Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { buildSuggestionMailto } from "@/lib/suggestionIssue"

/**
 * Contact page.
 *
 * The app has no backend, so sending just hands a prefilled message to the
 * visitor's own mail client. Everything the form could ask for — who they are,
 * what kind of feedback it is — they can write in the mail itself, so the page
 * asks for the message and nothing else.
 */
export function SuggestionForm() {
  const { t } = useTranslation()
  const [opened, setOpened] = React.useState(false)
  const [message, setMessage] = React.useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (message.trim().length < 10) {
      toast.error(t("suggestions.error_short"))
      return
    }

    // Navigating rather than window.open: a mailto handed to open() leaves a
    // blank tab behind in most browsers.
    window.location.href = buildSuggestionMailto(message)

    setOpened(true)
    toast.info(t("suggestions.finish_in_mail"))
  }

  return (
    <div className="h-full overflow-y-auto bg-background/50">
      <main className="w-full max-w-2xl mx-auto px-4 py-10 space-y-6">
        <div className="space-y-3 text-center">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
            {t("suggestions.title")}
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base max-w-lg mx-auto">
            {t("suggestions.subtitle")}
          </p>
        </div>

        {/* No card around the form: the textarea already carries its own
            border, and nesting it in a panel only added a grey frame. */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="message" className="text-sm font-semibold text-foreground">
              {t("suggestions.label_message")}
            </label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("suggestions.placeholder_message")}
              className="flex min-h-[160px] w-full rounded-xl border border-input bg-background px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 resize-y"
              required
            />
          </div>

          {opened && (
            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-primary text-sm">
              {t("suggestions.finish_in_mail")}
            </div>
          )}

          <Button
            type="submit"
            className="w-full h-12 rounded-xl text-base font-bold gap-2"
            disabled={message.trim().length < 10}
          >
            <Send className="w-4 h-4" />
            {t("suggestions.submit")}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            {t("suggestions.mail_hint")}
          </p>
        </form>
      </main>
    </div>
  )
}
