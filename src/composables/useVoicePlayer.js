// composables/useVoicePlayer.js

import { ref, computed, onBeforeUnmount } from 'vue'; // <-- 1. Import the hook

// --- Shared state for the audio player ---
const audio = ref(null);
const currentPlayingVoiceId = ref(null);
const isAudioLoading = ref(false);

/**
 * A composable for managing a single, shared audio player instance
 * for voice sample playback across the application.
 */
export function useVoicePlayer() {

  function getAudioUrl(voice) {

    return `https://cdn.soundranks.com/sampleAudioTTS/${voice.voice_service}-${voice.voice_speaker_id}.mp3`;
  }

  function stopAudio() {
    if (audio.value) {
      audio.value.pause();
      audio.value.oncanplaythrough = null;
      audio.value.onended = null;
      audio.value.onerror = null;
      audio.value.src = '';
      audio.value = null;
    }
    currentPlayingVoiceId.value = null;
    isAudioLoading.value = false;
  }

  function togglePlay(voice) {
    if (currentPlayingVoiceId.value === voice.voice_id) {
      if (audio.value) {
        if (isAudioLoading.value) {
          stopAudio();
          return;
        }
        if (audio.value.paused) {
          audio.value.play();
        } else {
          audio.value.pause();
        }
      } else {
        startNewPlayback(voice);
      }
    } else {
      startNewPlayback(voice);
    }
  }

  function startNewPlayback(voice) {
    stopAudio();

    currentPlayingVoiceId.value = voice.voice_id;
    isAudioLoading.value = true;

    const newAudio = new Audio(getAudioUrl(voice));
    audio.value = newAudio;

    newAudio.oncanplaythrough = () => {
      if (currentPlayingVoiceId.value === voice.voice_id) {
        isAudioLoading.value = false;
      }
    };
    newAudio.onended = () => {
      stopAudio();
    };
    newAudio.onerror = (e) => {
      console.error("Error loading audio file:", e);
      stopAudio();
    };

    const playPromise = newAudio.play();
    if (playPromise !== undefined) {
      playPromise.catch(error => {
        console.error("Audio Playback Error:", error);
        stopAudio();
      });
    }
  }

  const isPlaying = computed(() => (voiceId) => {
    return currentPlayingVoiceId.value === voiceId && audio.value && !audio.value.paused;
  });

  // --- 2. ADD LIFECYCLE HOOK FOR CLEANUP ---
  // When the component using this composable is unmounted, this will fire,
  // ensuring any playing audio is stopped cleanly.
  onBeforeUnmount(stopAudio);

  return {
    currentPlayingVoiceId,
    isAudioLoading,
    isPlaying,
    togglePlay,
    stopAudio,
  };
}