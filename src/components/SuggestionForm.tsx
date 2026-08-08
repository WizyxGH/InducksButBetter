import * as React from "react"
import { useTranslation } from "react-i18next"
import { MessageSquarePlus, Lightbulb, Bug, Database, Sparkles, ArrowLeft, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { navigate } from "@/lib/navigation";
import { buildSuggestionIssueUrl, DISCORD_INVITE_URL } from "@/lib/suggestionIssue"
import { GithubIcon } from "@/components/icons/GithubIcon"
import { DiscordIcon } from "@/components/icons/DiscordIcon"

export function SuggestionForm() {
  const { t } = useTranslation()
  // The app has no backend: "submitting" opens a prefilled GitHub issue in a
  // new tab, and this flag switches the UI to "finish posting over there"
  // instead of the (previously fake) "sent successfully".
  const [opened, setOpened] = React.useState(false)

  // Form State
  const [name, setName] = React.useState("")
  const [type, setType] = React.useState("idea")
  const [message, setMessage] = React.useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (message.trim().length < 10) {
      toast.error(t("suggestions.error_short", "Votre message est trop court (min 10 caractères)."))
      return
    }

    const url = buildSuggestionIssueUrl({ type, name, message })
    window.open(url, "_blank", "noopener")

    setOpened(true)
    toast.info(t("suggestions.finish_on_github"))
  }

  const goBack = () => {
    navigate("#/")
  }

  return (
    <div className="h-full overflow-y-auto bg-background/50 flex flex-col items-center">
      {/* Hero Header */}
      <section className="relative px-4 lg:px-12 py-12 flex flex-col items-center justify-center text-center gap-6 border-b border-border-subtle bg-gradient-to-b from-surface/30 to-background/10 w-full">
        <div className="space-y-3">
          <div className="w-16 h-16 mx-auto bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-4">
            <MessageSquarePlus className="w-8 h-8" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
            {t("suggestions.title", "Envoyez-nous vos suggestions")}
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base max-w-lg mx-auto">
            {t("suggestions.subtitle", "Une idée d'amélioration ? Un bug repéré ? Aidez-nous à rendre InducksButBetter encore plus génial !")}
          </p>
        </div>
      </section>

      {/* Main Form Area */}
      <main className="px-4 py-10 w-full max-w-2xl mx-auto space-y-6">
        <Button onClick={goBack} variant="outline" size="sm" className="rounded-xl gap-1.5 h-9 mb-4">
          <ArrowLeft className="w-4 h-4" />
          {t("common.back", "Retour à l'accueil")}
        </Button>

        <form onSubmit={handleSubmit} className="space-y-6 bg-surface p-6 sm:p-8 rounded-2xl border border-border-subtle shadow-sm">

          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-semibold text-foreground">
                {t("suggestions.label_name", "Nom ou Pseudo (optionnel)")}
              </label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("suggestions.placeholder_name", "Comment vous appelez-vous ?")}
                className="h-11 rounded-xl bg-background"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="type" className="text-sm font-semibold text-foreground">
                {t("suggestions.label_type", "Type de suggestion")}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { id: "idea", icon: Lightbulb, label: t("suggestions.type_idea", "Idée") },
                  { id: "bug", icon: Bug, label: t("suggestions.type_bug", "Bug") },
                  { id: "db", icon: Database, label: t("suggestions.type_db", "Données") },
                  { id: "other", icon: Sparkles, label: t("suggestions.type_other", "Autre") }
                ].map((option) => {
                  const Icon = option.icon
                  const isSelected = type === option.id
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setType(option.id)}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-200 gap-2
                        ${isSelected
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border-subtle bg-background text-muted-foreground hover:bg-surface-2"
                        }
                      `}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-xs font-semibold">{option.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="message" className="text-sm font-semibold text-foreground">
                {t("suggestions.label_message", "Votre message")} <span className="text-red-500">*</span>
              </label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t("suggestions.placeholder_message", "Détaillez votre idée ou le problème rencontré...")}
                className="flex min-h-[120px] w-full rounded-xl border border-input bg-background px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
                required
              />
            </div>
          </div>

          {/* The GitHub tab does the actual sending — say so instead of
              pretending the form itself submitted anything. */}
          {opened && (
            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-primary text-sm">
              {t("suggestions.finish_on_github")}
            </div>
          )}

          <div className="pt-2 space-y-3">
            <Button
              type="submit"
              className="w-full h-12 rounded-xl text-base font-bold gap-2"
              disabled={message.trim().length < 10}
            >
              <GithubIcon className="w-5 h-5" />
              {t("suggestions.submit_github")}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full h-11 rounded-xl gap-2"
              onClick={() => window.open(DISCORD_INVITE_URL, "_blank", "noopener")}
            >
              <DiscordIcon className="w-4 h-4 text-[#5865F2]" />
              {t("suggestions.btn_discord")}
              <ExternalLink className="w-3.5 h-3.5 opacity-60" />
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              {t("suggestions.github_hint")}
            </p>
          </div>
        </form>
      </main>
    </div>
  )
}
