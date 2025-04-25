/**
 * Suporte adicional para vozes em hebraico
 * Este módulo implementa métodos alternativos para gerar voz em hebraico
 */

// Configuração para uso da API Google Translate TTS (método gratuito)
const googleTranslateTTS = {
  available: true,

  generateSpeechURL: function (text, lang = 'he') {
    // URL da API não oficial do Google Translate TTS
    return `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=tw-ob`;
  },

  speak: function (text, lang = 'he', onStart, onEnd, onError) {
    try {
      const audio = new Audio();
      audio.src = this.generateSpeechURL(text, lang);

      // Callbacks
      audio.onplay = onStart;
      audio.onended = onEnd;
      audio.onerror = onError;

      // Reproduzir áudio
      audio.play();
      return true;
    } catch (error) {
      console.error('Erro ao usar Google Translate TTS:', error);
      if (onError) onError(error);
      return false;
    }
  },

  stop: function () {
    // Encontrar e parar todos os elementos de áudio
    document.querySelectorAll('audio').forEach((audio) => {
      if (audio.src.includes('translate.google.com')) {
        audio.pause();
        audio.currentTime = 0;
      }
    });
  },
};

// Extensão para o voiceSystem
export function extendVoiceSystem(voiceSystem) {
  // Adicionar método específico para hebraico
  voiceSystem.speakHebrew = function (text) {
    console.log('Usando método especializado para hebraico:', text);

    // Status para UI
    const onStart = () => {
      const speaking = document.createElement('div');
      speaking.id = 'assistant-speaking';
      speaking.className = 'assistant-speaking';
      speaking.innerHTML =
        '<div class="speaking-indicator"><span></span><span></span><span></span></div>';

      const assistantDialog = document.querySelector('#assistant-dialog');
      if (assistantDialog) assistantDialog.appendChild(speaking);

      document.dispatchEvent(new CustomEvent('assistant:speaking:start'));
    };

    const onEnd = () => {
      const speaking = document.getElementById('assistant-speaking');
      if (speaking) speaking.remove();

      document.dispatchEvent(new CustomEvent('assistant:speaking:end'));
    };

    const onError = (err) => {
      console.error('Erro na síntese de voz para hebraico:', err);
      onEnd(); // Limpa indicadores de fala
    };

    // Tentar primeiro com métodos nativos
    if (this.speak(text, 'he')) {
      return true;
    }

    // Fallback para Google Translate TTS
    return googleTranslateTTS.speak(text, 'he', onStart, onEnd, onError);
  };

  // Sobrescrever método speak para verificar se é hebraico
  const originalSpeak = voiceSystem.speak;
  voiceSystem.speak = function (text, language, voiceId) {
    if (language === 'he') {
      return this.speakHebrew(text);
    }

    return originalSpeak.call(this, text, language, voiceId);
  };

  // Sobrescrever método stop
  const originalStop = voiceSystem.stop;
  voiceSystem.stop = function () {
    originalStop.call(this);
    googleTranslateTTS.stop();
  };

  return voiceSystem;
}

export default {
  extendVoiceSystem,
};
