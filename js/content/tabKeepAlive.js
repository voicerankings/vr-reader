/**
 * ============================================================================
 * TabKeepAlive Module
 * ============================================================================
 * Chrome freezes hidden background tabs after ~5 minutes unless the tab is
 * considered "audible" (playing audio in the page itself). Because the actual
 * TTS audio is played from the extension's OFFSCREEN document, the tab hosting
 * the content script never counts as audible and gets frozen. A frozen tab
 * cannot process the `onEnded` callback that advances to the next sentence, so
 * playback silently stops until the user returns to the tab.
 *
 * This module keeps an inaudible, sub-sonic oscillator running in the page
 * while the reader is actively playing. Chrome's audio stream monitor sees a
 * non-zero output level (so the tab is exempt from freezing) while humans hear
 * nothing. The oscillator only runs while reading is active and is torn down
 * as soon as playback stops.
 *
 * NOTE: Chrome's autoplay policy requires a user gesture to start audible
 * output, so the keep-alive is also (re)started from the widget's play-button
 * click handlers where a gesture is available, and a one-shot listener resumes
 * it on the next user interaction if it was started outside a gesture.
 */

export function initTabKeepAlive() {
  const VR_Reader = window.VR_Reader || (window.VR_Reader = {});

  let keepAliveActive = false;
  let keepAliveContext = null;
  let keepAliveNodes = null;
  let gestureListenersInstalled = false;

  function ensureContext() {
    if (keepAliveContext || !keepAliveActive) return;

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;

      const ctx = new AudioContextClass();
      const gain = ctx.createGain();
      const osc = ctx.createOscillator();

      // Sub-sonic 1Hz sine: below the range of human hearing, but a clear,
      // non-zero audio stream so Chrome treats the tab as audible.
      osc.type = 'sine';
      osc.frequency.value = 1;
      gain.gain.value = 0.1;

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();

      keepAliveContext = ctx;
      keepAliveNodes = { gain, osc };
    } catch (e) {
      console.warn('Tab keep-alive audio unavailable:', e);
    }
  }

  function resumeIfNeeded() {
    if (!keepAliveActive) return;
    ensureContext();
    if (keepAliveContext && keepAliveContext.state === 'suspended') {
      keepAliveContext.resume().catch(() => {});
    }
  }

  function installGestureListeners() {
    if (gestureListenersInstalled) return;
    gestureListenersInstalled = true;
    document.addEventListener('pointerdown', resumeIfNeeded, true);
    document.addEventListener('keydown', resumeIfNeeded, true);
  }

  function start() {
    keepAliveActive = true;
    ensureContext();
    resumeIfNeeded();
    installGestureListeners();
  }

  function stop() {
    keepAliveActive = false;
    if (keepAliveContext) {
      try {
        if (keepAliveNodes && keepAliveNodes.osc) {
          keepAliveNodes.osc.stop();
        }
        keepAliveContext.close();
      } catch (e) {
        console.warn('Error closing tab keep-alive audio:', e);
      }
      keepAliveContext = null;
      keepAliveNodes = null;
    }
  }

  VR_Reader.startTabKeepAlive = start;
  VR_Reader.stopTabKeepAlive = stop;
}
