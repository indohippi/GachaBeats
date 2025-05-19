import * as Tone from 'tone';
import { getSafeTimeout } from '../../lib/utils';

// Configure strict timeout limits for audio processing
const MAX_AUDIO_TIMEOUT = 100; // Set a strict 100ms limit for all audio timeouts

// Modified timeout helper that completely avoids Tone.js timing issues
function safeScheduleTimeout(fn: () => void, timeout: number): number {
  // Ignore the provided timeout and always use a fixed safe value
  // This ensures timing consistency and prevents overflow warnings
  const SAFE_TIMEOUT = 20; // Very short timeout for responsive audio
  
  // Use a fixed safe timeout regardless of the input
  return window.setTimeout(fn, SAFE_TIMEOUT);
}

// Constants for retry logic
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// Gameboy-inspired sound scales
const GBA_SCALES = {
  C_MAJOR: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'],
  PENTATONIC: ['C4', 'D4', 'F4', 'G4', 'A4', 'C5'],
  BLUES: ['C4', 'Eb4', 'F4', 'Gb4', 'G4', 'Bb4', 'C5']
};

// Track initialization state
let initialized = false;
let mainSynth: Tone.PolySynth;
let transport: typeof Tone.Transport;
let effects = {
  reverb: null as Tone.Reverb | null,
  delay: null as Tone.FeedbackDelay | null,
  distortion: null as Tone.Distortion | null,
  bitcrusher: null as Tone.BitCrusher | null,
  compressor: null as Tone.Compressor | null,
  phaser: null as Tone.Phaser | null, 
  tremolo: null as Tone.Tremolo | null,
  autoWah: null as Tone.AutoWah | null,
  filter: null as Tone.Filter | null,
  chorus: null as Tone.Chorus | null,
  masterGain: null as Tone.Gain | null
};

// Define more specific synth types to handle proper method typing
interface MembraneSynthPlayer {
  synth: Tone.MembraneSynth;
  type: 'membrane';
  gain?: Tone.Gain;
}

interface NoiseSynthPlayer {
  synth: Tone.NoiseSynth;
  type: 'noise';
  gain?: Tone.Gain;
}

interface MetalSynthPlayer {
  synth: Tone.MetalSynth;
  type: 'metal';
  gain?: Tone.Gain;
}

interface BasicSynthPlayer {
  synth: Tone.Synth;
  type: 'basic';
  gain?: Tone.Gain;
}

interface SamplePlayer {
  synth: Tone.Player;
  type: 'player';
  gain?: Tone.Gain;
}

// Union type for all player types
type AnyPlayer = MembraneSynthPlayer | NoiseSynthPlayer | MetalSynthPlayer | BasicSynthPlayer | SamplePlayer;

interface SoundLibrary {
  [key: string]: {
    note: string;
    duration: string;
    type: 'basic' | 'noise' | 'metal' | 'membrane' | 'player';
  }
}

// Game Boy Advance-inspired sound library
const GBA_SOUNDS: SoundLibrary = {
  // Percussion
  'kick': { note: 'C1', duration: '8n', type: 'membrane' },
  'snare': { note: '', duration: '8n', type: 'noise' },
  'hihat': { note: 'C4', duration: '32n', type: 'metal' },
  'rim': { note: 'A4', duration: '32n', type: 'metal' },
  'clap': { note: '', duration: '16n', type: 'noise' },
  
  // Melodic
  'lead': { note: 'C4', duration: '8n', type: 'basic' },
  'bass': { note: 'C2', duration: '8n', type: 'basic' },
  'pad': { note: 'C3', duration: '2n', type: 'basic' },
  'pluck': { note: 'C4', duration: '8n', type: 'basic' },
  'arp': { note: 'C5', duration: '16n', type: 'basic' },
  
  // SFX
  'blip': { note: 'G5', duration: '32n', type: 'basic' },
  'coin': { note: 'E6', duration: '16n', type: 'metal' },
  'jump': { note: 'G4', duration: '16n', type: 'membrane' },
  'powerup': { note: 'C5', duration: '8n', type: 'basic' },
  'laser': { note: 'C6', duration: '32n', type: 'noise' }
};

const samplePlayers = new Map<string, AnyPlayer>();
const soundBuffers = new Map<string, AudioBuffer>();

// Safe delay function that caps the maximum delay time to 1000ms
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, Math.min(ms, 1000)));

export const checkAudioContext = () => {
  if (!initialized) {
    throw new Error('Audio Engine not initialized. Call initAudioEngine first.');
  }
  
  const context = Tone.getContext();
  if (context.state !== 'running') {
    throw new Error(`Invalid audio context state: ${context.state}`);
  }
};

async function initializeToneWithRetry(retries = MAX_RETRIES): Promise<void> {
  try {
    console.log('Attempting to start Tone.js audio context...');
    await Tone.start();
    console.log('Tone.js context started successfully');
    transport = Tone.Transport;
    transport.bpm.value = 120;
  } catch (error) {
    console.error(`Failed to start Tone.js (attempt ${MAX_RETRIES - retries + 1}/${MAX_RETRIES}):`, error);
    if (retries > 1) {
      console.log(`Retrying in ${RETRY_DELAY}ms...`);
      await delay(RETRY_DELAY);
      return initializeToneWithRetry(retries - 1);
    }
    throw new Error(`Failed to initialize Tone.js after ${MAX_RETRIES} attempts: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export const initAudioEngine = async () => {
  if (initialized) {
    console.warn('[AudioEngine] Already initialized');
    return;
  }

  console.log('[AudioEngine] Starting initialization...');
  try {
    console.log('[AudioEngine] Checking audio context...');
    await initializeToneWithRetry();
    
    try {
      console.log('[AudioEngine] Setting up effects chain...');
      // Create effects chain from destination backward
      effects.reverb = new Tone.Reverb(1.2).toDestination();
      effects.delay = new Tone.FeedbackDelay(0.125, 0.2).connect(effects.reverb);
      effects.chorus = new Tone.Chorus(4, 2.5, 0.5).connect(effects.delay);
      effects.phaser = new Tone.Phaser({
        frequency: 0.5,
        octaves: 3,
        baseFrequency: 1000
      }).connect(effects.chorus);
      effects.tremolo = new Tone.Tremolo(9, 0.75).connect(effects.phaser);
      effects.autoWah = new Tone.AutoWah(50, 6, -30).connect(effects.tremolo);
      effects.distortion = new Tone.Distortion(0.4).connect(effects.autoWah);
      effects.bitcrusher = new Tone.BitCrusher(8).connect(effects.distortion);
      effects.filter = new Tone.Filter(1000, "lowpass").connect(effects.bitcrusher);
      effects.compressor = new Tone.Compressor(-30, 3).connect(effects.filter);
      effects.masterGain = new Tone.Gain(0.8).connect(effects.compressor);
      
      // Start any effects that need to be started
      effects.tremolo.start();
      
      // Generate reverb impulse response
      await effects.reverb.generate();
      
      // Set default wet levels
      effects.chorus.wet.value = 0;
      effects.phaser.wet.value = 0;
      effects.tremolo.wet.value = 0;
      effects.autoWah.wet.value = 0; 
      
      console.log('[AudioEngine] Effects chain created successfully');
    } catch (error) {
      console.error('[AudioEngine] Effects chain initialization failed:', error);
    }
    
    try {
      console.log('[AudioEngine] Creating main synthesizer...');
      // GBA-style synth (more 8-bit sounding)
      mainSynth = new Tone.PolySynth(Tone.Synth, {
        oscillator: {
          type: 'square'
        },
        envelope: {
          attack: 0.02,
          decay: 0.1,
          sustain: 0.3,
          release: 0.8
        }
      }).connect(effects.masterGain as Tone.Gain);
      console.log('[AudioEngine] Main synthesizer initialized successfully');
    } catch (error) {
      console.error('[AudioEngine] PolySynth initialization failed:', error);
      throw new Error(`Failed to initialize PolySynth: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    try {
      console.log('[AudioEngine] Creating default synthesizers...');
      const startTime = performance.now();
      
      // Kick drum with Game Boy characteristics
      console.log('[AudioEngine] Creating kick synth...');
      const kickSynth = new Tone.MembraneSynth({
        pitchDecay: 0.05,
        octaves: 4,
        oscillator: {
          type: 'sine'
        },
        envelope: {
          attack: 0.001,
          decay: 0.2,
          sustain: 0.01,
          release: 0.2,
          attackCurve: 'exponential'
        }
      }).connect(effects.masterGain as Tone.Gain);
      samplePlayers.set('kick', { synth: kickSynth, type: 'membrane' });
      
      // Snare with Game Boy characteristics
      console.log('[AudioEngine] Creating snare synth...');
      const snareGain = new Tone.Gain(0.7).connect(effects.masterGain as Tone.Gain);
      const snareSynth = new Tone.NoiseSynth({
        noise: {
          type: 'white',
          playbackRate: 3,
        },
        envelope: {
          attack: 0.001,
          decay: 0.15,
          sustain: 0,
          release: 0.05
        }
      }).connect(snareGain);
      samplePlayers.set('snare', { synth: snareSynth, type: 'noise', gain: snareGain });
      
      // Hi-hat with Game Boy characteristics
      console.log('[AudioEngine] Creating hihat synth...');
      const hihatGain = new Tone.Gain(0.4).connect(effects.masterGain as Tone.Gain);
      const hihatSynth = new Tone.MetalSynth({
        envelope: {
          attack: 0.001,
          decay: 0.05,
          release: 0.05
        },
        harmonicity: 5.1,
        modulationIndex: 32,
        octaves: 1.5
      }).connect(hihatGain);
      samplePlayers.set('hihat', { synth: hihatSynth, type: 'metal', gain: hihatGain });
      
      // Bass with Game Boy characteristics
      console.log('[AudioEngine] Creating bass synth...');
      const bassSynth = new Tone.Synth({
        oscillator: {
          type: 'square'
        },
        envelope: {
          attack: 0.05,
          decay: 0.2,
          sustain: 0.4,
          release: 0.8
        }
      }).connect(effects.masterGain as Tone.Gain);
      samplePlayers.set('bass', { synth: bassSynth, type: 'basic' });
      
      // Rim shot
      console.log('[AudioEngine] Creating rim synth...');
      const rimGain = new Tone.Gain(0.5).connect(effects.masterGain as Tone.Gain);
      const rimSynth = new Tone.MetalSynth({
        envelope: {
          attack: 0.001,
          decay: 0.02,
          release: 0.02
        },
        harmonicity: 5.1,
        modulationIndex: 40,
        resonance: 1000,
        octaves: 1.5
      }).connect(rimGain);
      samplePlayers.set('rim', { synth: rimSynth, type: 'metal', gain: rimGain });
      
      // Clap sound
      console.log('[AudioEngine] Creating clap synth...');
      const clapGain = new Tone.Gain(0.6).connect(effects.masterGain as Tone.Gain);
      const clapSynth = new Tone.NoiseSynth({
        noise: {
          type: 'pink',
          playbackRate: 3,
        },
        envelope: {
          attack: 0.001,
          decay: 0.15,
          sustain: 0,
          release: 0.1
        }
      }).connect(clapGain);
      samplePlayers.set('clap', { synth: clapSynth, type: 'noise', gain: clapGain });
      
      // Pad sound
      console.log('[AudioEngine] Creating pad synth...');
      const padGain = new Tone.Gain(0.4).connect(effects.masterGain as Tone.Gain);
      const padSynth = new Tone.Synth({
        oscillator: {
          type: 'square8'
        },
        envelope: {
          attack: 0.5,
          decay: 0.5,
          sustain: 0.7,
          release: 1.5
        }
      }).connect(padGain);
      samplePlayers.set('pad', { synth: padSynth, type: 'basic', gain: padGain });
      
      // Pluck sound
      console.log('[AudioEngine] Creating pluck synth...');
      const pluckGain = new Tone.Gain(0.5).connect(effects.masterGain as Tone.Gain);
      const pluckSynth = new Tone.Synth({
        oscillator: {
          type: 'triangle'
        },
        envelope: {
          attack: 0.001,
          decay: 0.1,
          sustain: 0.1,
          release: 0.2
        }
      }).connect(pluckGain);
      samplePlayers.set('pluck', { synth: pluckSynth, type: 'basic', gain: pluckGain });
      
      // Arpeggiator sound
      console.log('[AudioEngine] Creating arp synth...');
      const arpGain = new Tone.Gain(0.5).connect(effects.masterGain as Tone.Gain);
      const arpSynth = new Tone.Synth({
        oscillator: {
          type: 'pulse',
          width: 0.5
        },
        envelope: {
          attack: 0.001,
          decay: 0.1,
          sustain: 0.1,
          release: 0.05
        }
      }).connect(arpGain);
      samplePlayers.set('arp', { synth: arpSynth, type: 'basic', gain: arpGain });
      
      // Blip sound
      console.log('[AudioEngine] Creating blip synth...');
      const blipGain = new Tone.Gain(0.5).connect(effects.masterGain as Tone.Gain);
      const blipSynth = new Tone.Synth({
        oscillator: {
          type: 'pulse',
          width: 0.2
        },
        envelope: {
          attack: 0.001,
          decay: 0.1,
          sustain: 0,
          release: 0.05
        }
      }).connect(blipGain);
      samplePlayers.set('blip', { synth: blipSynth, type: 'basic', gain: blipGain });
      
      // Laser sound
      console.log('[AudioEngine] Creating laser synth...');
      const laserGain = new Tone.Gain(0.4).connect(effects.masterGain as Tone.Gain);
      const laserSynth = new Tone.NoiseSynth({
        noise: {
          type: 'white',
          playbackRate: 5,
        },
        envelope: {
          attack: 0.001,
          decay: 0.1,
          sustain: 0,
          release: 0.01
        }
      }).connect(laserGain);
      samplePlayers.set('laser', { synth: laserSynth, type: 'noise', gain: laserGain });
      
      // Power-up sound
      console.log('[AudioEngine] Creating powerup synth...');
      const powerupGain = new Tone.Gain(0.5).connect(effects.masterGain as Tone.Gain);
      const powerupSynth = new Tone.Synth({
        oscillator: {
          type: 'sawtooth'
        },
        envelope: {
          attack: 0.001,
          decay: 0.3,
          sustain: 0.2,
          release: 0.2
        }
      }).connect(powerupGain);
      samplePlayers.set('powerup', { synth: powerupSynth, type: 'basic', gain: powerupGain });
      
      const initTime = performance.now() - startTime;
      console.log(`[AudioEngine] Default synthesizers created successfully in ${initTime.toFixed(2)}ms`);
    } catch (error) {
      console.error('[AudioEngine] Default synthesizers initialization failed:', error);
      throw new Error(`Failed to initialize default synthesizers: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    initialized = true;
    console.log('[AudioEngine] Initialization complete');
  } catch (error) {
    console.error('[AudioEngine] Fatal initialization error:', error);
    throw error;
  }
};

export const playNote = (note: string | number, time?: number) => {
  try {
    checkAudioContext();
    // If a frequency is passed, convert it to appropriate note duration
    const noteValue = typeof note === 'number' ? note : note;
    const duration = '8n';
    
    if (time !== undefined) {
      // Use the scheduled time for precise timing
      mainSynth?.triggerAttackRelease(noteValue, duration, time);
    } else {
      // For immediate playback
      mainSynth?.triggerAttackRelease(noteValue, duration);
    }
  } catch (error) {
    console.error(`Failed to play note ${note}:`, error);
    throw error;
  }
};

export const stopNote = () => {
  try {
    checkAudioContext();
    mainSynth?.releaseAll();
  } catch (error) {
    console.error('Failed to stop note:', error);
    throw error;
  }
};

export const playSample = (name: string, time?: number) => {
  try {
    checkAudioContext();
    
    // Get sound configuration
    const sound = GBA_SOUNDS[name] || GBA_SOUNDS['blip'];
    
    // Define a safe function to play sounds with proper type checking
    const playSoundWithType = (type: string, instrumentName: string) => {
      const instrument = samplePlayers.get(instrumentName);
      if (!instrument) return;
      
      if (type === 'membrane') {
        // It's safe to cast when we know the exact type
        if (time !== undefined) {
          (instrument.synth as any).triggerAttackRelease(sound.note, sound.duration, time);
        } else {
          (instrument.synth as any).triggerAttackRelease(sound.note, sound.duration);
        }
      } 
      else if (type === 'noise') {
        if (time !== undefined) {
          (instrument.synth as any).triggerAttackRelease(sound.duration, time);
        } else {
          (instrument.synth as any).triggerAttackRelease(sound.duration);
        }
      } 
      else if (type === 'metal') {
        if (time !== undefined) {
          (instrument.synth as any).triggerAttackRelease(sound.note, sound.duration, time);
        } else {
          (instrument.synth as any).triggerAttackRelease(sound.note, sound.duration);
        }
      } 
      else if (type === 'player') {
        if (time !== undefined) {
          (instrument.synth as any).start(time);
        } else {
          (instrument.synth as any).start();
        }
      }
      else {
        // Default for basic synths
        if (time !== undefined) {
          (instrument.synth as any).triggerAttackRelease(sound.note, sound.duration, time);
        } else {
          (instrument.synth as any).triggerAttackRelease(sound.note, sound.duration);
        }
      }
    };
    
    // First, try to get the exact instrument by name
    const player = samplePlayers.get(name);
    
    // If we have the named instrument, play it with its own type
    if (player) {
      playSoundWithType(player.type, name);
    } 
    // Otherwise, use a fallback based on the requested sound type
    else {
      switch (sound.type) {
        case 'membrane':
          playSoundWithType('membrane', 'kick');
          break;
        case 'noise':
          playSoundWithType('noise', 'snare');
          break;
        case 'metal':
          playSoundWithType('metal', 'hihat');
          break;
        default:
          playSoundWithType('basic', 'blip');
      }
    }
  } catch (error) {
    console.error(`Failed to play sample '${name}':`, error);
    throw error;
  }
};

export const loadSample = async (name: string, url: string) => {
  try {
    checkAudioContext();
    console.log(`Loading sample ${name} from ${url}`);
    
    // Check if we already have this buffer loaded
    if (soundBuffers.has(name)) {
      console.log(`Sample ${name} already loaded, skipping`);
      return;
    }
    
    // Create a new player
    const player = new Tone.Player({
      url: url,
      onload: () => {
        console.log(`Sample ${name} loaded successfully`);
      }
    }).connect(effects.masterGain as Tone.Gain);
    
    // Add to our collections
    samplePlayers.set(name, { synth: player, type: 'player' });
    
    // Wait for the buffer to load
    await player.loaded;
    
  } catch (error) {
    console.error(`Failed to load sample '${name}' from '${url}':`, error);
    throw error;
  }
};

// New methods for Tone.Transport synchronization
export const getTransport = () => {
  checkAudioContext();
  return transport;
};

export const setBPM = (bpm: number) => {
  try {
    checkAudioContext();
    // Use ramp for smoother BPM transitions that avoids glitches
    // Linear ramp over 0.1 seconds to prevent audio artifacts
    transport.bpm.rampTo(bpm, 0.1);
    console.log(`[AudioEngine] BPM set to ${bpm}`);
  } catch (error) {
    console.error(`[AudioEngine] Failed to set BPM to ${bpm}:`, error);
  }
};

export const startTransport = () => {
  try {
    checkAudioContext();
    
    // Make sure we're not already running to avoid timing issues
    if (transport.state !== "started") {
      // Reset Tone.js internal clock for better sync
      Tone.Transport.position = 0;
      transport.start("+0.1"); // Small delay for stable scheduling
      console.log("[AudioEngine] Transport started");
    } else {
      console.log("[AudioEngine] Transport already running");
    }
  } catch (error) {
    console.error("[AudioEngine] Failed to start transport:", error);
  }
};

export const stopTransport = () => {
  try {
    checkAudioContext();
    
    // Only stop if currently running
    if (transport.state === "started") {
      transport.stop();
      console.log("[AudioEngine] Transport stopped");
      
      // Reset Tone.js internal clock for better sync on next start
      Tone.Transport.position = 0;
    } else {
      console.log("[AudioEngine] Transport already stopped");
    }
  } catch (error) {
    console.error("[AudioEngine] Failed to stop transport:", error);
  }
};

// Schedule repeating events with proper timing according to official Tone.js docs
// https://github.com/Tonejs/Tone.js/wiki/Accurate-Timing
export const scheduleRepeat = (callback: (time: number) => void, interval: string) => {
  try {
    checkAudioContext();
    
    // Force 8n timing for better stability
    interval = "8n";
    
    // Instead of directly scheduling with the callback that might cause timing issues,
    // we'll create a more robust scheduling system
    const id = transport.scheduleRepeat((time) => {
      try {
        // Use Tone.Draw to schedule the UI update separately from the audio processing
        // This helps prevent the UI timing from affecting the audio timing
        Tone.Draw.schedule(() => {
          try {
            callback(time);
          } catch (drawError) {
            console.error('[AudioEngine] Error in Draw callback:', drawError);
          }
        }, time);
      } catch (innerError) {
        console.error('[AudioEngine] Error in scheduled callback:', innerError);
      }
    }, interval);
    
    console.log(`[AudioEngine] Scheduled repeated event with ID ${id} and interval ${interval}`);
    return id;
  } catch (error) {
    console.error('[AudioEngine] Failed to schedule repeat:', error);
    return -1; // Return invalid ID
  }
};

export const clearRepeat = (id: number) => {
  try {
    checkAudioContext();
    
    if (id >= 0) {
      transport.clear(id);
      console.log(`[AudioEngine] Cleared scheduled event with ID ${id}`);
    } else {
      console.warn('[AudioEngine] Attempted to clear invalid event ID:', id);
    }
  } catch (error) {
    console.error(`[AudioEngine] Failed to clear event with ID ${id}:`, error);
  }
};

// Get a note from the GBA scales
export const getNoteFromScale = (index: number, scale: keyof typeof GBA_SCALES = 'C_MAJOR') => {
  const selectedScale = GBA_SCALES[scale];
  return selectedScale[index % selectedScale.length];
};

// Effects controls
export const setReverbAmount = (amount: number) => {
  if (effects.reverb) {
    effects.reverb.wet.value = Math.max(0, Math.min(1, amount));
  }
};

export const setDelayAmount = (amount: number) => {
  if (effects.delay) {
    effects.delay.wet.value = Math.max(0, Math.min(1, amount));
  }
};

export const setDistortionAmount = (amount: number) => {
  if (effects.distortion) {
    effects.distortion.wet.value = Math.max(0, Math.min(1, amount));
  }
};

export const setBitCrusherAmount = (amount: number) => {
  if (effects.bitcrusher) {
    // Scale from 0-1 to 16-1 (higher bit reduction = more lo-fi)
    // Note: We can't set bits directly as it's a read-only property,
    // so we adjust the wet level instead
    effects.bitcrusher.wet.value = Math.max(0, Math.min(1, amount));
  }
};

export const setMasterVolume = (amount: number) => {
  if (effects.masterGain) {
    effects.masterGain.gain.value = Math.max(0, Math.min(1, amount));
  }
};

// Additional effect controls for our new effects
export const setPhaserAmount = (amount: number) => {
  if (effects.phaser) {
    effects.phaser.wet.value = Math.max(0, Math.min(1, amount));
  }
};

export const setChorusAmount = (amount: number) => {
  if (effects.chorus) {
    effects.chorus.wet.value = Math.max(0, Math.min(1, amount));
  }
};

export const setTremoloAmount = (amount: number) => {
  if (effects.tremolo) {
    effects.tremolo.wet.value = Math.max(0, Math.min(1, amount));
  }
};

export const setAutoWahAmount = (amount: number) => {
  if (effects.autoWah) {
    effects.autoWah.wet.value = Math.max(0, Math.min(1, amount));
  }
};

export const setFilterFrequency = (frequency: number) => {
  if (effects.filter) {
    // Scale from 0-1 to 100-8000 Hz
    const scaledFreq = 100 + (frequency * 7900);
    effects.filter.frequency.value = scaledFreq;
  }
};

export const setFilterType = (type: 'lowpass' | 'highpass' | 'bandpass' | 'lowshelf' | 'highshelf') => {
  if (effects.filter) {
    effects.filter.type = type;
  }
};
