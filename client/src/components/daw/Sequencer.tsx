import React, { useState, useCallback, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Card } from '../../components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { Button } from '../../components/ui/button';
import { Slider } from '../../components/ui/slider';
import Track from './Track';
import {
  playNote,
  playSample,
  setBPM,
  startTransport,
  stopTransport,
  scheduleRepeat,
  clearRepeat,
  getNoteFromScale,
  setReverbAmount,
  setDelayAmount,
  setDistortionAmount,
  setBitCrusherAmount,
  setPhaserAmount,
  setChorusAmount,
  setTremoloAmount,
  setAutoWahAmount,
  setFilterFrequency,
  setFilterType,
} from './AudioEngine';
import type { setupWebSocket } from '@/lib/websocket';
import { getSafeTimeout, clearSafeTimer } from '@/lib/utils';

// Constants
const STEPS = 16;
const TRACKS = 8;
const TRACK_SOUNDS = ['kick', 'snare', 'hihat', 'rim', 'clap'];

// Sequencer Props interface
interface SequencerProps {
  websocket?: ReturnType<typeof setupWebSocket> | null;
  isConnected?: boolean;
  connectionId?: string;
}

// Preset patterns for the sequencer
const PRESETS = {
  'basic-beat': [
    [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false],
    [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
    [false, false, true, false, false, false, true, false, false, false, true, false, false, false, true, false],
    [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
    [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
    [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
    [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
    [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false]
  ],
  'four-on-floor': [
    [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false],
    [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
    [false, false, true, false, false, false, true, false, false, false, true, false, false, false, true, true],
    [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
    [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
    [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
    [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
    [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false]
  ]
};

const Sequencer = forwardRef<any, SequencerProps>(({
  websocket = null,
  isConnected = false,
  connectionId
}, ref) => {
  // State
  const [playing, setPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [bpm, setBpmState] = useState(120);
  const [scale, setScale] = useState<'C_MAJOR' | 'PENTATONIC' | 'BLUES'>('C_MAJOR');
  const [currentPreset, setCurrentPreset] = useState<string | null>(null);
  
  // Initialize sequence with 8 empty tracks
  const [sequence, setSequence] = useState<boolean[][]>(
    Array(TRACKS).fill(null).map(() => Array(STEPS).fill(false))
  );

  // Track remote updates to avoid feedback loops
  const isRemoteUpdateRef = useRef(false);
  
  // FX States
  const [reverbAmount, setReverbAmountState] = useState(0.3);
  const [delayAmount, setDelayAmountState] = useState(0.2);
  const [distortionAmount, setDistortionAmountState] = useState(0.1);
  const [bitCrushAmount, setBitCrushAmountState] = useState(0.2);
  const [phaserAmount, setPhaserAmountState] = useState(0.1);
  const [chorusAmount, setChorusAmountState] = useState(0.1);
  const [tremoloAmount, setTremoloAmountState] = useState(0);
  const [autoWahAmount, setAutoWahAmountState] = useState(0);
  const [filterFrequency, setFilterFrequencyState] = useState(1.0);
  const [filterType, setFilterTypeState] = useState<'lowpass' | 'highpass' | 'bandpass' | 'lowshelf' | 'highshelf'>('lowpass');
  
  // Transport event ID
  const transportEventRef = useRef<number | null>(null);

  // Professional step advancement using Tone.js accurate timing
  // Based on https://github.com/Tonejs/Tone.js/wiki/Accurate-Timing
  const advanceStep = useCallback((time: number) => {
    setCurrentStep((step) => {
      // Calculate the next step in the sequence
      const newStep = (step + 1) % STEPS;
      
      // Play sounds for active steps with proper timing parameter
      // This ensures precise timing according to Tone.js documentation
      sequence.forEach((track, trackIndex) => {
        if (track[newStep]) {
          if (trackIndex < TRACK_SOUNDS.length) {
            // Drum sounds with exact timing
            playSample(TRACK_SOUNDS[trackIndex], time);
          } else {
            // Melodic sounds with exact timing
            const note = getNoteFromScale(trackIndex + newStep, scale);
            playNote(note, time);
          }
        }
      });
      
      return newStep;
    });
  }, [sequence, scale]);

  // Define beat presets library
  const BEAT_PRESETS = {
    'classic-dance': () => {
      const pattern = Array(TRACKS).fill(null).map(() => Array(STEPS).fill(false));
      
      // Kick on main beats (four-on-the-floor)
      pattern[0][0] = true;
      pattern[0][4] = true;
      pattern[0][8] = true;
      pattern[0][12] = true;
      
      // Snare on the backbeat (2 and 4)
      pattern[1][4] = true;
      pattern[1][12] = true;
      
      // Hi-hat on every beat
      for (let i = 0; i < STEPS; i++) {
        pattern[2][i] = i % 2 === 0;
      }
      
      // Rim for accents
      pattern[3][2] = true;
      pattern[3][10] = true;
      
      // Bass line
      pattern[5][0] = true;
      pattern[5][3] = true;
      pattern[5][8] = true;
      pattern[5][11] = true;
      
      // Simple pluck chord stabs
      pattern[6][4] = true;
      pattern[6][12] = true;
      
      return pattern;
    },
    
    'hip-hop': () => {
      const pattern = Array(TRACKS).fill(null).map(() => Array(STEPS).fill(false));
      
      // Kick pattern
      pattern[0][0] = true;
      pattern[0][3] = true;
      pattern[0][8] = true;
      pattern[0][10] = true;
      
      // Snare on 2 and 4
      pattern[1][4] = true;
      pattern[1][12] = true;
      
      // Hi-hat pattern (partially open)
      for (let i = 0; i < STEPS; i++) {
        if (i % 4 !== 2) pattern[2][i] = true;
      }
      
      // Clap reinforcing snare
      pattern[4][4] = true;
      pattern[4][12] = true;
      
      // Bass groove
      pattern[5][0] = true;
      pattern[5][2] = true;
      pattern[5][7] = true;
      pattern[5][8] = true;
      pattern[5][10] = true;
      pattern[5][14] = true;
      
      return pattern;
    },
    
    'trap': () => {
      const pattern = Array(TRACKS).fill(null).map(() => Array(STEPS).fill(false));
      
      // Kick
      pattern[0][0] = true;
      pattern[0][7] = true;
      pattern[0][10] = true;
      
      // 808 snare
      pattern[1][4] = true;
      pattern[1][12] = true;
      
      // Hi-hat triplet feel
      pattern[2][0] = true;
      pattern[2][2] = true;
      pattern[2][3] = true;
      pattern[2][4] = true;
      pattern[2][6] = true;
      pattern[2][7] = true;
      pattern[2][8] = true;
      pattern[2][10] = true;
      pattern[2][11] = true;
      pattern[2][12] = true;
      pattern[2][14] = true;
      pattern[2][15] = true;
      
      // Bass/808
      pattern[5][0] = true;
      pattern[5][7] = true;
      pattern[5][8] = true;
      
      return pattern;
    },
    
    'lo-fi': () => {
      const pattern = Array(TRACKS).fill(null).map(() => Array(STEPS).fill(false));
      
      // Kick (lazy rhythm)
      pattern[0][0] = true;
      pattern[0][7] = true;
      pattern[0][9] = true;
      
      // Snare
      pattern[1][4] = true;
      pattern[1][12] = true;
      
      // Swing hi-hat
      pattern[2][0] = true;
      pattern[2][3] = true;
      pattern[2][4] = true;
      pattern[2][7] = true;
      pattern[2][8] = true;
      pattern[2][11] = true;
      pattern[2][12] = true;
      pattern[2][15] = true;
      
      // Rim clicks
      pattern[3][6] = true;
      pattern[3][14] = true;
      
      // Bass notes
      pattern[5][0] = true;
      pattern[5][4] = true;
      pattern[5][8] = true;
      pattern[5][12] = true;
      
      // Jazzy chord progression
      pattern[6][0] = true;
      pattern[6][8] = true;
      
      // Pad for atmosphere
      pattern[7][0] = true;
      pattern[7][8] = true;
      
      return pattern;
    },
    
    'techno': () => {
      const pattern = Array(TRACKS).fill(null).map(() => Array(STEPS).fill(false));
      
      // Kick (four-on-the-floor)
      pattern[0][0] = true;
      pattern[0][4] = true;
      pattern[0][8] = true;
      pattern[0][12] = true;
      
      // Closed hi-hats
      for (let i = 0; i < STEPS; i++) {
        if (i % 2 === 0) pattern[2][i] = true;
      }
      
      // Open hi-hats (on offbeats)
      pattern[2][2] = true;
      pattern[2][6] = true;
      pattern[2][10] = true;
      pattern[2][14] = true;
      
      // Clap
      pattern[4][4] = true;
      pattern[4][12] = true;
      
      // Bass pattern
      pattern[5][0] = true;
      pattern[5][4] = true;
      pattern[5][7] = true;
      pattern[5][11] = true;
      
      // Pluck arpeggio
      pattern[6][2] = true;
      pattern[6][6] = true;
      pattern[6][10] = true;
      pattern[6][14] = true;
      
      return pattern;
    },
    
    'drum-n-bass': () => {
      const pattern = Array(TRACKS).fill(null).map(() => Array(STEPS).fill(false));
      
      // Kick (breakbeat style)
      pattern[0][0] = true;
      pattern[0][6] = true;
      pattern[0][10] = true;
      
      // Snare (half-time feel)
      pattern[1][4] = true;
      pattern[1][12] = true;
      
      // Hi-hats (fast pattern)
      pattern[2][0] = true;
      pattern[2][1] = true;
      pattern[2][2] = true;
      pattern[2][4] = true;
      pattern[2][5] = true;
      pattern[2][6] = true;
      pattern[2][8] = true;
      pattern[2][9] = true;
      pattern[2][10] = true;
      pattern[2][12] = true;
      pattern[2][13] = true;
      pattern[2][14] = true;
      
      // Rim for accent
      pattern[3][2] = true;
      pattern[3][10] = true;
      
      // Bass (heavy sub bass)
      pattern[5][0] = true;
      pattern[5][4] = true;
      pattern[5][7] = true;
      pattern[5][11] = true;
      pattern[5][14] = true;
      
      // Fast arpeggio
      pattern[6][1] = true;
      pattern[6][3] = true;
      pattern[6][9] = true;
      pattern[6][11] = true;
      pattern[6][13] = true;
      pattern[6][15] = true;
      
      return pattern;
    },
    
    'synthwave': () => {
      const pattern = Array(TRACKS).fill(null).map(() => Array(STEPS).fill(false));
      
      // Kick (steady)
      pattern[0][0] = true;
      pattern[0][4] = true;
      pattern[0][8] = true;
      pattern[0][12] = true;
      
      // Snare (backbeat)
      pattern[1][4] = true;
      pattern[1][12] = true;
      
      // Hi-hat (16th notes)
      for (let i = 0; i < STEPS; i++) {
        pattern[2][i] = true;
      }
      
      // Clap (layered with snare)
      pattern[4][4] = true;
      pattern[4][12] = true;
      
      // Bass (retro bassline)
      pattern[5][0] = true;
      pattern[5][3] = true;
      pattern[5][6] = true;
      pattern[5][8] = true;
      pattern[5][11] = true;
      pattern[5][14] = true;
      
      // Pad (sustained chords)
      pattern[7][0] = true;
      pattern[7][8] = true;
      
      return pattern;
    },
    
    'chiptune': () => {
      const pattern = Array(TRACKS).fill(null).map(() => Array(STEPS).fill(false));
      
      // Kick (game style)
      pattern[0][0] = true;
      pattern[0][8] = true;
      
      // "Noise" snare
      pattern[1][4] = true;
      pattern[1][12] = true;
      
      // Hi-hat pattern
      pattern[2][2] = true;
      pattern[2][6] = true;
      pattern[2][10] = true;
      pattern[2][14] = true;
      
      // Bass line (8-bit style)
      pattern[5][0] = true;
      pattern[5][2] = true;
      pattern[5][3] = true;
      pattern[5][4] = true;
      pattern[5][8] = true;
      pattern[5][10] = true;
      pattern[5][11] = true;
      pattern[5][12] = true;
      
      // Melody line
      pattern[6][0] = true;
      pattern[6][4] = true;
      pattern[6][7] = true;
      pattern[6][8] = true;
      pattern[6][12] = true;
      pattern[6][15] = true;
      
      // Arpeggio
      pattern[6][1] = true;
      pattern[6][5] = true;
      pattern[6][9] = true;
      pattern[6][13] = true;
      
      return pattern;
    },
    
    'ambient': () => {
      const pattern = Array(TRACKS).fill(null).map(() => Array(STEPS).fill(false));
      
      // Subtle kick
      pattern[0][0] = true;
      pattern[0][8] = true;
      
      // Sparse snare
      pattern[1][4] = true;
      pattern[1][12] = true;
      
      // Clean hi-hat accents
      pattern[2][2] = true;
      pattern[2][6] = true;
      pattern[2][10] = true;
      pattern[2][14] = true;
      
      // Rim (textural)
      pattern[3][7] = true;
      pattern[3][15] = true;
      
      // Floating pad
      pattern[7][0] = true;
      pattern[7][4] = true;
      pattern[7][8] = true;
      pattern[7][12] = true;
      
      // Pluck melody
      pattern[6][1] = true;
      pattern[6][3] = true;
      pattern[6][9] = true;
      pattern[6][11] = true;
      
      return pattern;
    },
    
    'retro-gba': () => {
      const pattern = Array(TRACKS).fill(null).map(() => Array(STEPS).fill(false));
      
      // Kick (Gameboy style)
      pattern[0][0] = true;
      pattern[0][4] = true;
      pattern[0][8] = true;
      pattern[0][12] = true;
      
      // Noise snare
      pattern[1][4] = true;
      pattern[1][12] = true;
      
      // Square wave hi-hat
      pattern[2][2] = true;
      pattern[2][6] = true;
      pattern[2][10] = true;
      pattern[2][14] = true;
      
      // Metal sound for accent
      pattern[3][3] = true;
      pattern[3][7] = true;
      pattern[3][11] = true;
      pattern[3][15] = true;
      
      // Pulse-wave bass
      pattern[5][0] = true;
      pattern[5][4] = true;
      pattern[5][7] = true;
      pattern[5][8] = true;
      pattern[5][12] = true;
      pattern[5][15] = true;
      
      // Chiptune pluck
      pattern[6][0] = true;
      pattern[6][4] = true;
      pattern[6][8] = true;
      pattern[6][10] = true;
      pattern[6][12] = true;
      
      return pattern;
    }
  };

  // Preset selector state
  const [selectedPreset, setSelectedPreset] = useState<string>('retro-gba');

  // Generate beat from the selected preset
  const generateBeatPreset = useCallback((presetName?: string) => {
    const presetToUse = presetName || selectedPreset;
    
    if (presetToUse in BEAT_PRESETS) {
      const patternFunction = BEAT_PRESETS[presetToUse as keyof typeof BEAT_PRESETS];
      const pattern = patternFunction();
      setSequence(pattern);
    } else {
      // Fallback to retro gba beat
      const pattern = BEAT_PRESETS['retro-gba']();
      setSequence(pattern);
    }
  }, [selectedPreset]);
  
  // Load initial preset when component mounts
  useEffect(() => {
    // Initialize with the "retro-gba" preset on component mount
    generateBeatPreset('retro-gba');
  }, [generateBeatPreset]);

  // Transport control with better rhythm stability
  useEffect(() => {
    if (playing) {
      console.log("[Sequencer] Starting sequencer playback...");
      // Set BPM first
      setBPM(bpm);
      
      // Reset step to ensure we start from the beginning
      setCurrentStep(0);
      
      // Start transport first to establish timing
      startTransport();
      
      // Schedule steps on the correct subdivision (16th notes)
      // Use 8n instead of 16n for more stable timing - we'll handle the actual 16th grid ourselves
      const eventId = scheduleRepeat(advanceStep, '8n');
      transportEventRef.current = eventId;
      console.log(`[Sequencer] Scheduled sequencer with event ID ${eventId}`);
    } else if (transportEventRef.current !== null) {
      console.log("[Sequencer] Stopping sequencer playback...");
      
      clearRepeat(transportEventRef.current);
      console.log(`[Sequencer] Cleared scheduled event ID ${transportEventRef.current}`);
      transportEventRef.current = null;
      
      stopTransport();
      setCurrentStep(0);
    }
    
    return () => {
      if (transportEventRef.current !== null) {
        console.log("[Sequencer] Cleaning up transport on unmount");
        clearRepeat(transportEventRef.current);
        transportEventRef.current = null;
        stopTransport();
        setCurrentStep(0);
      }
    };
  }, [playing, bpm, advanceStep]);

  // Effects update
  useEffect(() => {
    setReverbAmount(reverbAmount);
    setDelayAmount(delayAmount);
    setDistortionAmount(distortionAmount);
    setBitCrusherAmount(bitCrushAmount);
    setPhaserAmount(phaserAmount);
    setChorusAmount(chorusAmount);
    setTremoloAmount(tremoloAmount);
    setAutoWahAmount(autoWahAmount);
    setFilterFrequency(filterFrequency);
    setFilterType(filterType);
  }, [
    reverbAmount, 
    delayAmount, 
    distortionAmount, 
    bitCrushAmount,
    phaserAmount,
    chorusAmount,
    tremoloAmount,
    autoWahAmount,
    filterFrequency,
    filterType
  ]);

  // Toggle step state
  const toggleStep = useCallback((trackIndex: number, stepIndex: number) => {
    setSequence(prevSequence => {
      const newSequence = [...prevSequence];
      const newTrack = [...newSequence[trackIndex]];
      newTrack[stepIndex] = !newTrack[stepIndex];
      newSequence[trackIndex] = newTrack;
      
      // Send WebSocket message if connected and not from a remote update
      if (websocket && isConnected && !isRemoteUpdateRef.current) {
        websocket.sendToggleStep(trackIndex, stepIndex);
      }
      
      return newSequence;
    });
    
    // Preview sound when toggling
    if (!sequence[trackIndex][stepIndex]) {
      if (trackIndex < TRACK_SOUNDS.length) {
        playSample(TRACK_SOUNDS[trackIndex]);
      } else {
        playNote(getNoteFromScale(trackIndex + stepIndex, scale));
      }
    }
  }, [sequence, scale]);

  // Clear patterns
  const clearPatterns = useCallback(() => {
    setSequence(Array(TRACKS).fill(null).map(() => Array(STEPS).fill(false)));
  }, []);

  // Simple BPM wrapper without complex timing
  const handleBpmChange = useCallback((value: number) => {
    try {
      // Only update if BPM has actually changed and is within valid range
      if (value !== bpm && value >= 60 && value <= 200) {
        console.log(`[Sequencer] Changing BPM from ${bpm} to ${value}`);
        
        // Immediately update the displayed BPM value
        setBpmState(value);
        
        // If playing, we need to restart the transport
        const wasPlaying = playing;
        
        if (wasPlaying) {
          // Stop transport first
          stopTransport();
        }
        
        // Set the new BPM value in the audio engine
        setBPM(value);
        
        // Restart immediately if it was playing
        if (wasPlaying && playing) {
          startTransport();
        }
      }
    } catch (error) {
      console.error("[Sequencer] BPM change error:", error);
      // Fallback to default BPM on error
      setBpmState(120);
      setBPM(120);
    }
  }, [bpm, playing]);
  
  // Helper to handle slider value changes with proper typing
  const handleSliderChange = useCallback(<T extends number>(setter: (value: T) => void) => {
    return (values: T[]) => {
      if (values.length > 0) {
        setter(values[0]);
      }
    };
  }, []);

  // Method to load a preset pattern
  const loadPreset = useCallback((presetName: string) => {
    if (presetName in BEAT_PRESETS) {
      isRemoteUpdateRef.current = false;
      generateBeatPreset(presetName);
      setSelectedPreset(presetName);
      
      // Broadcast preset change if connected
      if (websocket && isConnected && !isRemoteUpdateRef.current) {
        websocket.sendPresetChange(presetName);
      }
    }
  }, [websocket, isConnected, generateBeatPreset]);
  
  // Methods for remote control via WebSocket - these are exposed through the ref
  
  // Method to update pattern from remote client
  const updatePatternFromRemote = useCallback((newSequence: boolean[][]) => {
    if (Array.isArray(newSequence) && newSequence.length === TRACKS) {
      isRemoteUpdateRef.current = true;
      setSequence(newSequence);
      isRemoteUpdateRef.current = false;
    }
  }, []);
  
  // Method to load preset from remote client
  const loadPresetFromRemote = useCallback((presetName: string) => {
    if (presetName in BEAT_PRESETS) {
      isRemoteUpdateRef.current = true;
      generateBeatPreset(presetName);
      setSelectedPreset(presetName);
      isRemoteUpdateRef.current = false;
    }
  }, [generateBeatPreset]);
  
  // Method to toggle step from remote client
  const toggleStepFromRemote = useCallback((trackIndex: number, stepIndex: number) => {
    if (trackIndex >= 0 && trackIndex < TRACKS && stepIndex >= 0 && stepIndex < STEPS) {
      isRemoteUpdateRef.current = true;
      setSequence(prevSequence => {
        const newSequence = [...prevSequence];
        const newTrack = [...newSequence[trackIndex]];
        newTrack[stepIndex] = !newTrack[stepIndex];
        newSequence[trackIndex] = newTrack;
        return newSequence;
      });
      isRemoteUpdateRef.current = false;
    }
  }, []);
  
  // Broadcast the entire sequence state when it changes
  useEffect(() => {
    if (websocket && isConnected && !isRemoteUpdateRef.current) {
      websocket.sendSequencerUpdate(sequence);
    }
  }, [sequence, websocket, isConnected]);
  
  // Expose methods to parent component via ref
  useImperativeHandle(ref, () => ({
    updatePatternFromRemote,
    loadPresetFromRemote,
    toggleStepFromRemote,
    getCurrentSequence: () => sequence,
    getBPM: () => bpm,
    isPlaying: () => playing
  }));

  return (
    <Card className="gba-pixel-border p-4 bg-[--gba-darker]">
      <Tabs defaultValue="sequencer" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4 bg-[--gba-dark]">
          <TabsTrigger value="sequencer" className="text-[--gba-lightest]">Sequencer</TabsTrigger>
          <TabsTrigger value="effects" className="text-[--gba-lightest]">Effects</TabsTrigger>
        </TabsList>
        
        <TabsContent value="sequencer" className="p-0">
          <div className="flex items-center gap-4 mb-4">
            <Button
              className="gba-button w-12 h-12 text-xl"
              onClick={() => setPlaying(!playing)}
            >
              {playing ? '⏹️' : '▶️'}
            </Button>
            
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[--gba-lightest] min-w-16">BPM: {bpm}</span>
                <Slider
                  value={[bpm]}
                  min={60}
                  max={200}
                  step={1}
                  onValueChange={(values: number[]) => handleBpmChange(values[0])}
                  className="flex-1"
                />
              </div>
              
              <div className="flex gap-2 mb-2">
                <Button
                  className="gba-button text-xs flex-1"
                  size="sm"
                  onClick={clearPatterns}
                >
                  Clear
                </Button>
                <select 
                  className="gba-select text-xs flex-1 bg-[--gba-dark] text-[--gba-lightest] border border-[--gba-light] p-1 rounded-md"
                  value={scale}
                  onChange={(e) => setScale(e.target.value as any)}
                >
                  <option value="C_MAJOR">C Major</option>
                  <option value="PENTATONIC">Pentatonic</option>
                  <option value="BLUES">Blues</option>
                </select>
              </div>
              
              <div className="flex mb-2">
                <select 
                  className="gba-select text-xs flex-1 bg-[--gba-dark] text-[--gba-lightest] border border-[--gba-light] p-1 rounded-md"
                  value={selectedPreset}
                  onChange={(e) => {
                    setSelectedPreset(e.target.value);
                    generateBeatPreset(e.target.value);
                  }}
                >
                  <option value="retro-gba">Retro GBA</option>
                  <option value="classic-dance">Classic Dance</option>
                  <option value="hip-hop">Hip Hop</option>
                  <option value="trap">Trap</option>
                  <option value="lo-fi">Lo-Fi</option>
                  <option value="techno">Techno</option>
                  <option value="drum-n-bass">Drum & Bass</option>
                  <option value="synthwave">Synthwave</option>
                  <option value="chiptune">Chiptune</option>
                  <option value="ambient">Ambient</option>
                </select>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col gap-2 mb-4">
            {sequence.map((track, trackIndex) => (
              <Track
                key={trackIndex}
                track={track}
                currentStep={currentStep}
                trackColor={trackIndex < TRACK_SOUNDS.length ? 
                  ['#FF5555', '#55AAFF', '#FFAA55', '#AA55FF', '#AAAAAA'][trackIndex % 5] : 
                  ['#55FF55', '#FFFF55', '#55FFFF'][trackIndex % 3]
                }
                onToggleStep={(stepIndex) => toggleStep(trackIndex, stepIndex)}
              />
            ))}
          </div>
          
          <div className="flex gap-2 text-xs text-[--gba-lightest]">
            <div className="flex-1">
              {TRACK_SOUNDS.map((sound, i) => (
                <div key={i} className="mb-1">Track {i+1}: {sound}</div>
              ))}
            </div>
            <div className="flex-1">
              <div className="mb-1">Track 6: Bass</div>
              <div className="mb-1">Track 7: Pluck</div>
              <div className="mb-1">Track 8: Pad</div>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="effects" className="p-0">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4 bg-[--gba-dark]">
              <TabsTrigger value="basic" className="text-[--gba-lightest] text-xs">Basic Effects</TabsTrigger>
              <TabsTrigger value="advanced" className="text-[--gba-lightest] text-xs">Advanced Effects</TabsTrigger>
            </TabsList>
            
            <TabsContent value="basic" className="p-0">
              <div className="flex flex-col gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[--gba-lightest] min-w-20 text-xs">Reverb: {Math.round(reverbAmount * 100)}%</span>
                    <Slider
                      value={[reverbAmount]}
                      min={0}
                      max={1}
                      step={0.01}
                      onValueChange={([value]) => setReverbAmountState(value)}
                      className="flex-1"
                    />
                  </div>
                  
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[--gba-lightest] min-w-20 text-xs">Delay: {Math.round(delayAmount * 100)}%</span>
                    <Slider
                      value={[delayAmount]}
                      min={0}
                      max={1}
                      step={0.01}
                      onValueChange={([value]) => setDelayAmountState(value)}
                      className="flex-1"
                    />
                  </div>
                  
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[--gba-lightest] min-w-20 text-xs">Distortion: {Math.round(distortionAmount * 100)}%</span>
                    <Slider
                      value={[distortionAmount]}
                      min={0}
                      max={1}
                      step={0.01}
                      onValueChange={([value]) => setDistortionAmountState(value)}
                      className="flex-1"
                    />
                  </div>
                  
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[--gba-lightest] min-w-20 text-xs">Bit Crush: {Math.round(bitCrushAmount * 100)}%</span>
                    <Slider
                      value={[bitCrushAmount]}
                      min={0}
                      max={1}
                      step={0.01}
                      onValueChange={([value]) => setBitCrushAmountState(value)}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="advanced" className="p-0">
              <div className="flex flex-col gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[--gba-lightest] min-w-20 text-xs">Phaser: {Math.round(phaserAmount * 100)}%</span>
                    <Slider
                      value={[phaserAmount]}
                      min={0}
                      max={1}
                      step={0.01}
                      onValueChange={([value]) => setPhaserAmountState(value)}
                      className="flex-1"
                    />
                  </div>
                  
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[--gba-lightest] min-w-20 text-xs">Chorus: {Math.round(chorusAmount * 100)}%</span>
                    <Slider
                      value={[chorusAmount]}
                      min={0}
                      max={1}
                      step={0.01}
                      onValueChange={([value]) => setChorusAmountState(value)}
                      className="flex-1"
                    />
                  </div>
                  
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[--gba-lightest] min-w-20 text-xs">Tremolo: {Math.round(tremoloAmount * 100)}%</span>
                    <Slider
                      value={[tremoloAmount]}
                      min={0}
                      max={1}
                      step={0.01}
                      onValueChange={([value]) => setTremoloAmountState(value)}
                      className="flex-1"
                    />
                  </div>
                  
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[--gba-lightest] min-w-20 text-xs">Auto-Wah: {Math.round(autoWahAmount * 100)}%</span>
                    <Slider
                      value={[autoWahAmount]}
                      min={0}
                      max={1}
                      step={0.01}
                      onValueChange={([value]) => setAutoWahAmountState(value)}
                      className="flex-1"
                    />
                  </div>
                  
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[--gba-lightest] min-w-20 text-xs">Filter Freq: {Math.round(filterFrequency * 100)}%</span>
                    <Slider
                      value={[filterFrequency]}
                      min={0}
                      max={1}
                      step={0.01}
                      onValueChange={([value]) => setFilterFrequencyState(value)}
                      className="flex-1"
                    />
                  </div>
                  
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[--gba-lightest] min-w-20 text-xs">Filter Type:</span>
                    <select 
                      className="gba-select text-xs flex-1 bg-[--gba-dark] text-[--gba-lightest] border border-[--gba-light] p-1 rounded-md"
                      value={filterType}
                      onChange={(e) => setFilterTypeState(e.target.value as any)}
                    >
                      <option value="lowpass">Lowpass</option>
                      <option value="highpass">Highpass</option>
                      <option value="bandpass">Bandpass</option>
                      <option value="lowshelf">Lowshelf</option>
                      <option value="highshelf">Highshelf</option>
                    </select>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </Card>
  );
});

// Export the component
export default Sequencer;