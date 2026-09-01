import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import { Vibration, Platform } from 'react-native';

let sound: Audio.Sound | null = null;
let looping = false;
let generation = 0;
let resumeTimer: ReturnType<typeof setTimeout> | null = null;

const ANDROID_PATTERN = [0, 500, 200, 500, 200, 800];

async function ensureAudioMode() {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    staysActiveInBackground: true,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
    interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
    interruptionModeIOS: InterruptionModeIOS.DoNotMix,
  });
}

function clearResumeTimer() {
  if (resumeTimer) {
    clearTimeout(resumeTimer);
    resumeTimer = null;
  }
}

function armResume(player: Audio.Sound, gen: number) {
  player.setOnPlaybackStatusUpdate((status) => {
    if (generation !== gen || !looping || !status.isLoaded) return;
    if (status.isPlaying || status.isBuffering) return;
    clearResumeTimer();
    resumeTimer = setTimeout(() => {
      if (generation !== gen || !looping) return;
      void player.playAsync().catch(() => {
        if (generation === gen && looping) void startJobBuzzer({ force: true });
      });
    }, 250);
  });
}

/** Loop the job buzzer until accept, decline, or expiry. */
export async function startJobBuzzer(opts?: { force?: boolean }): Promise<void> {
  if (looping && !opts?.force && sound) {
    try {
      const status = await sound.getStatusAsync();
      if (status.isLoaded && status.isPlaying) return;
    } catch {
      // recreate below
    }
  }
  const gen = ++generation;
  looping = true;
  try {
    await ensureAudioMode();
    if (sound) {
      try {
        await sound.stopAsync();
        await sound.unloadAsync();
      } catch {
        //
      }
      sound = null;
    }
    if (generation !== gen || !looping) return;
    const created = await Audio.Sound.createAsync(
      require('../assets/sounds/job_alert.wav'),
      { isLooping: true, shouldPlay: true, volume: 1, isMuted: false },
    );
    if (generation !== gen || !looping) {
      try {
        await created.sound.stopAsync();
        await created.sound.unloadAsync();
      } catch {
        //
      }
      return;
    }
    sound = created.sound;
    armResume(sound, gen);
    if (Platform.OS === 'android') {
      Vibration.cancel();
      Vibration.vibrate(ANDROID_PATTERN, true);
    } else {
      Vibration.vibrate();
    }
  } catch (err) {
    if (generation === gen) looping = false;
    console.warn('[jobAlert] buzzer failed', err);
  }
}

export async function stopJobBuzzer(): Promise<void> {
  generation += 1;
  looping = false;
  clearResumeTimer();
  Vibration.cancel();
  if (!sound) return;
  const current = sound;
  sound = null;
  current.setOnPlaybackStatusUpdate(null);
  try {
    await current.stopAsync();
    await current.unloadAsync();
  } catch {
    // already released
  }
}

export function isJobBuzzerPlaying() {
  return looping;
}
