export function isSpeechRecognitionSupported() {
  if (typeof window === 'undefined') return false
  return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window
}

export function createSpeechRecognition() {
  if (!isSpeechRecognitionSupported()) {
    throw new Error('Speech recognition not supported')
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
  return new SpeechRecognition()
}

export function transcribeAudio(audioBlob, language = 'fr-FR') {
  return new Promise((resolve, reject) => {
    if (!isSpeechRecognitionSupported()) {
      reject(new Error('Speech recognition not supported'))
      return
    }

    const recognition = createSpeechRecognition()
    recognition.lang = language
    recognition.continuous = false
    recognition.interimResults = false

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript
      resolve(transcript)
    }

    recognition.onerror = (event) => {
      reject(new Error(`Speech recognition error: ${event.error}`))
    }

    recognition.onend = () => {
      if (!recognition.result) {
        reject(new Error('No result'))
      }
    }

    // Pour l'instant, l'API Web Speech ne supporte que la transcription en temps réel
    // Pour transcrire un fichier audio, nous aurions besoin d'une solution backend
    // Cette fonction est un placeholder pour une implémentation future
    resolve('')
  })
}

// Alternative: transcription en temps réel pendant l'enregistrement
export function startRealtimeTranscription(onResult, onError, language = 'fr-FR') {
  if (!isSpeechRecognitionSupported()) {
    onError(new Error('Speech recognition not supported'))
    return null
  }

  const recognition = createSpeechRecognition()
  recognition.lang = language
  recognition.continuous = true
  recognition.interimResults = true

  recognition.onresult = (event) => {
    let interimTranscript = ''
    let finalTranscript = ''

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript
      if (event.results[i].isFinal) {
        finalTranscript += transcript
      } else {
        interimTranscript += transcript
      }
    }

    onResult({ final: finalTranscript, interim: interimTranscript })
  }

  recognition.onerror = (event) => {
    onError(new Error(`Speech recognition error: ${event.error}`))
  }

  recognition.start()
  return recognition
}
