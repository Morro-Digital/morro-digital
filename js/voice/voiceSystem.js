// voiceSystem.js - Gerenciamento de voz do assistente

let voiceLang = "pt";
let synth = window.speechSynthesis;
let recognition;

/**
 * Inicializa o sistema de voz, ajustando o idioma.
 * @param {string} lang - Código do idioma (ex: 'pt', 'en', 'es', 'he').
 */
export function initVoice(lang = "pt") {
  voiceLang = lang;

  if (!synth) {
    console.warn("SpeechSynthesis API não está disponível neste navegador.");
  }

  // Inicializa o reconhecimento de voz
  if ("SpeechRecognition" in window || "webkitSpeechRecognition" in window) {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.lang = getVoiceLocale(voiceLang);
    recognition.interimResults = false;
    recognition.continuous = false;
  } else {
    console.warn("SpeechRecognition API não está disponível neste navegador.");
  }
}

/**
 * Fala o texto usando a API SpeechSynthesis.
 * @param {string} text - Texto a ser falado.
 */
export function speak(text) {
  if (!synth) return;

  // Evita sobreposição de falas
  if (synth.speaking) synth.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = getVoiceLocale(voiceLang);
  synth.speak(utterance);
}

/**
 * Captura a entrada de voz do usuário.
 * @param {Function} onResult - Callback para processar o texto reconhecido.
 */
export function startVoiceRecognition(onResult) {
  if (!recognition) {
    alert("Reconhecimento de voz não está disponível neste navegador.");
    return;
  }

  recognition.start();

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript.trim();
    console.log("[Voice Recognition] Texto reconhecido:", transcript);
    if (onResult) onResult(transcript);
  };

  recognition.onerror = (event) => {
    console.error("[Voice Recognition] Erro:", event.error);
    alert("Erro no reconhecimento de voz. Tente novamente.");
  };

  recognition.onend = () => {
    console.log("[Voice Recognition] Reconhecimento finalizado.");
  };
}

/**
 * Mapeia código de idioma para o formato aceito pela Web Speech API.
 * @param {string} lang - Ex: 'pt', 'en', 'es', 'he'
 * @returns {string} Código de localidade (ex: 'pt-BR')
 */
function getVoiceLocale(lang) {
  switch (lang) {
    case "pt":
      return "pt-BR";
    case "en":
      return "en-US";
    case "es":
      return "es-ES";
    case "he":
      return "he-IL";
    default:
      return "pt-BR";
  }
}
