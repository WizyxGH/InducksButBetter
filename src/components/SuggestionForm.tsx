import * as React from "react"
import { useTranslation } from "react-i18next"
import { Send, MessageSquarePlus, Lightbulb, Bug, Database, Sparkles, Loader2, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { navigate } from "@/lib/navigation";

export function SuggestionForm() {
  const { t } = useTranslation()
  const [loading, setLoading] = React.useState(false)
  const [success, setSuccess] = React.useState(false)

  // Form State
  const [name, setName] = React.useState("")
  const [type, setType] = React.useState("idea")
  const [message, setMessage] = React.useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (message.trim().length < 10) {
      toast.error(t("suggestions.error_short", "Votre message est trop court (min 10 caractères)."))
      return
    }

    setLoading(true)

    // Simuler un envoi réseau
    await new Promise((resolve) => setTimeout(resolve, 1200))

    setLoading(false)
    setSuccess(true)
    toast.success(t("suggestions.success", "Merci ! Votre suggestion a bien été envoyée."))
    
    // Reset form
    setName("")
    setType("idea")
    setMessage("")
    
    setTimeout(() => setSuccess(false), 3000)
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
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
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
                disabled={loading}
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
                      disabled={loading}
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
                disabled={loading}
              />
            </div>
          </div>

          <div className="pt-2">
            <Button 
              type="submit" 
              className={`w-full h-12 rounded-xl text-base font-bold transition-all ${success ? "bg-green-500 hover:bg-green-600 text-white" : ""}`}
              disabled={loading || message.trim().length < 10}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  {t("suggestions.sending", "Envoi en cours...")}
                </>
              ) : success ? (
                t("suggestions.sent", "Envoyé avec succès !")
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  {t("suggestions.submit", "Envoyer la suggestion")}
                </>
              )}
            </Button>
          </div>
        </form>
      </main>
    </div>
  )
}
