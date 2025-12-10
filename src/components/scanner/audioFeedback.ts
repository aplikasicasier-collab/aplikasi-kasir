/**
 * Audio Feedback Utility
 * Provides audio feedback (beep sound) for barcode scanning
 * Requirements: 1.5
 */

// Audio context for generating beep sounds
let audioContext: AudioContext | null = null;

/**
 * Initialize the audio context
 * Must be called after user interaction due to browser autoplay policies
 */
export function initAudioFeedback(): void {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
}

/**
 * Play a beep sound for successful scan
 * Uses Web Audio API to generate a short beep tone
 * @param frequency - Frequency of the beep in Hz (default: 1000)
 * @param duration - Duration of the beep in ms (default: 100)
 * @param volume - Volume level 0-1 (default: 0.3)
 */
export function playBeepSound(
  frequency: number = 1000,
  duration: number = 100,
  volume: number = 0.3
): void {
  try {
    // Initialize audio context if not already done
    if (!audioContext) {
      initAudioFeedback();
    }

    if (!audioContext) {
      console.warn('Audio context not available');
      return;
    }

    // Resume audio context if suspended (browser autoplay policy)
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }

    // Create oscillator for the beep tone
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    // Configure oscillator
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);

    // Configure gain (volume)
    gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
    // Fade out to prevent click at the end
    gainNode.gain.exponentialRampToValueAtTime(
      0.001,
      audioContext.currentTime + duration / 1000
    );

    // Connect nodes
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Play the beep
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration / 1000);
  } catch (error) {
    console.warn('Failed to play beep sound:', error);
  }
}

/**
 * Play success beep (higher pitch, pleasant tone)
 */
export function playSuccessBeep(): void {
  playBeepSound(1200, 100, 0.3);
}

/**
 * Play error beep (lower pitch, two short beeps)
 */
export function playErrorBeep(): void {
  playBeepSound(400, 150, 0.3);
  setTimeout(() => {
    playBeepSound(400, 150, 0.3);
  }, 200);
}

/**
 * Play warning beep (medium pitch)
 */
export function playWarningBeep(): void {
  playBeepSound(800, 200, 0.25);
}

/**
 * Check if audio feedback is available
 */
export function isAudioFeedbackAvailable(): boolean {
  return !!(window.AudioContext || (window as any).webkitAudioContext);
}

/**
 * Clean up audio context
 */
export function cleanupAudioFeedback(): void {
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
}
