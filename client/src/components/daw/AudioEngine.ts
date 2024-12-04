import * as Tone from 'tone';

// Constants for retry logic
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// Track initialization state
let initialized = false;
let synth: Tone.PolySynth;
const samplePlayers = new Map<string, Tone.Synth>();

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
    
    // Initialize synthesizer with error handling
    try {
      console.log('[AudioEngine] Creating main synthesizer...');
      synth = new Tone.PolySynth(Tone.Synth).toDestination();
      console.log('[AudioEngine] Main synthesizer initialized successfully');
    } catch (error) {
      console.error('[AudioEngine] PolySynth initialization failed:', error);
      throw new Error(`Failed to initialize PolySynth: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // Initialize default synthesized sounds with detailed logging
    try {
      console.log('[AudioEngine] Creating default synthesizers...');
      const startTime = performance.now();
      
      console.log('[AudioEngine] Creating kick synth...');
      const kickSynth = new Tone.MembraneSynth().toDestination();
      samplePlayers.set('kick', kickSynth);
      
      console.log('[AudioEngine] Creating snare synth...');
      const snareSynth = new Tone.NoiseSynth().toDestination();
      samplePlayers.set('snare', snareSynth);
      
      console.log('[AudioEngine] Creating hihat synth...');
      const hihatSynth = new Tone.MetalSynth().toDestination();
      samplePlayers.set('hihat', hihatSynth);
      
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

export const playNote = (frequency: number) => {
  try {
    checkAudioContext();
    synth?.triggerAttackRelease(frequency, "8n");
  } catch (error) {
    console.error(`Failed to play note at frequency ${frequency}:`, error);
    throw error;
  }
};

export const stopNote = () => {
  try {
    checkAudioContext();
    synth?.releaseAll();
  } catch (error) {
    console.error('Failed to stop note:', error);
    throw error;
  }
};

export const playSample = (name: string) => {
  try {
    checkAudioContext();
    const player = samplePlayers.get(name);
    if (!player) {
      throw new Error(`Sample '${name}' not found`);
    }

    if (name === 'kick') {
      (player as Tone.MembraneSynth).triggerAttackRelease('C1', '8n');
    } else if (name === 'snare') {
      (player as Tone.NoiseSynth).triggerAttackRelease('8n');
    } else if (name === 'hihat') {
      (player as Tone.MetalSynth).triggerAttackRelease('32n');
    }
  } catch (error) {
    console.error(`Failed to play sample '${name}':`, error);
    throw error;
  }
};

export const loadSample = async (name: string, url: string) => {
  try {
    checkAudioContext();
    // This will be implemented when we add the gacha system
    console.log(`Loading sample ${name} from ${url} - Not implemented yet`);
  } catch (error) {
    console.error(`Failed to load sample '${name}' from '${url}':`, error);
    throw error;
  }
};
