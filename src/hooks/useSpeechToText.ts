import { useState, useRef, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

export function useSpeechToText() {
  const { i18n } = useTranslation()
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState("")
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = i18n.language.startsWith('fr') ? 'fr-FR' : 'en-US'

    recognition.onstart = () => {
      setIsRecording(true)
    }

    recognition.onresult = (event: any) => {
      let currentTranscript = ""
      for (let i = 0; i < event.results.length; i++) {
        currentTranscript += event.results[i][0].transcript
      }
      setTranscript(currentTranscript)
    }

    recognition.onerror = (e: any) => {
      setIsRecording(false)
      
      if (e.error === 'not-allowed') {
        toast.error("Accès au microphone refusé. Vérifiez les autorisations de votre navigateur.")
      } else if (e.error === 'no-speech') {
        toast.error("Aucune voix détectée. Parlez plus fort ou vérifiez votre micro.")
      } else {
        toast.error(`Erreur du microphone: ${e.error}`)
      }
    }

    recognition.onend = () => {
      setIsRecording(false)
    }

    recognitionRef.current = recognition
    return () => recognition.stop()
  }, [i18n.language])

  const toggleRecording = () => {
    if (!recognitionRef.current) return

    if (isRecording) {
      try {
        recognitionRef.current.stop()
      } catch {
        setIsRecording(false)
      }
      return
    }

    try {
      setTranscript("")
      recognitionRef.current.start()
    } catch (err: any) {
      if (err.name !== 'InvalidStateError') {
        toast.error("Impossible de démarrer l’enregistrement vocal.")
      }
    }
  }

  return { isRecording, transcript, setTranscript, toggleRecording, isSupported: !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) }
}
