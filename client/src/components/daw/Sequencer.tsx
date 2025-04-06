import { useState, useEffect, useCallback, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import Track from './Track';
import { 
  playNote, 
  playSample, 
  setBPM, 
  startTransport, 
  stopTransport, 
  scheduleRepeat, 
  clearRepeat,
  setReverbAmount,
  setDelayAmount,
  setDistortionAmount,
  setBitCrusherAmount,
  getNoteFromScale
} from './AudioEngine';

const STEPS = 16;
const TRACKS = 4;
const TRACK_SOUNDS = ['kick', 'snare', 'hihat', 'blip'];

// Gameboy-style colors
const GBA_COLORS = [
  '#8bac0f', // Green
  '#9bbc0f', // Light Green
  '#306230', // Dark Green
  '#0f380f'  // Darkest Green
];

export default function Sequencer() {
  // State
  const [playing, setPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [bpm, setBpmState] = useState(120);
  const [scale, setScale] = useState<'C_MAJOR' | 'PENTATONIC' | 'BLUES'>('C_MAJOR');
  
  // Effects state
  const [reverbAmount, setReverbAmountState] = useState(0.3);
  const [delayAmount, setDelayAmountState] = useState(0.2);
  const [distortionAmount, setDistortionAmountState] = useState(0.1);
  const [bitCrushAmount, setBitCrushAmountState] = useState(0.4);
  
  // Initialize sequence with proper immutable structure
  const [sequence, setSequence] = useState<boolean[][]>(() => 
    Array(TRACKS).fill(null).map(() => Array(STEPS).fill(false))
  );

  // Transport event ID
  const transportEventRef = useRef<number | null>(null);

  // Step advancement function
  const advanceStep = useCallback(() => {
    setCurrentStep((step) => {
      const newStep = (step + 1) % STEPS;
      
      // Play sounds for active steps
      sequence.forEach((track, trackIndex) => {
        if (track[newStep]) {
          if (trackIndex < TRACK_SOUNDS.length) {
            // Use our predefined sounds for drums
            playSample(TRACK_SOUNDS[trackIndex]);
          } else {
            // Use notes from scale for melodic parts
            playNote(getNoteFromScale(trackIndex + newStep, scale));
          }
        }
      });
      
      return newStep;
    });
  }, [sequence, scale]);

  // Transport control
  useEffect(() => {
    if (playing) {
      // Set BPM in Tone.Transport
      setBPM(bpm);
      
      // Schedule step advancement
      const sixteenthNote = '16n';
      const eventId = scheduleRepeat(advanceStep, sixteenthNote);
      transportEventRef.current = eventId;
      
      // Start transport
      startTransport();
    } else if (transportEventRef.current !== null) {
      // Clear the scheduled event
      clearRepeat(transportEventRef.current);
      transportEventRef.current = null;
      
      // Stop transport
      stopTransport();
    }
    
    return () => {
      // Cleanup
      if (transportEventRef.current !== null) {
        clearRepeat(transportEventRef.current);
        transportEventRef.current = null;
        stopTransport();
      }
    };
  }, [playing, bpm, advanceStep]);

  // Effects update
  useEffect(() => {
    setReverbAmount(reverbAmount);
    setDelayAmount(delayAmount);
    setDistortionAmount(distortionAmount);
    setBitCrusherAmount(bitCrushAmount);
  }, [reverbAmount, delayAmount, distortionAmount, bitCrushAmount]);

  // Toggle step state
  const toggleStep = useCallback((trackIndex: number, stepIndex: number) => {
    setSequence(prevSequence => {
      const newSequence = [...prevSequence];
      const newTrack = [...newSequence[trackIndex]];
      newTrack[stepIndex] = !newTrack[stepIndex];
      newSequence[trackIndex] = newTrack;
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

  // Set BPM wrapper
  const handleBpmChange = useCallback((value: number) => {
    setBpmState(value);
    setBPM(value);
  }, []);

  // Generate a simple demo pattern
  const generateDemoPattern = useCallback(() => {
    const demoPattern = Array(TRACKS).fill(null).map(() => Array(STEPS).fill(false));
    
    // Kick on beats 1 and 9
    demoPattern[0][0] = true;
    demoPattern[0][8] = true;
    
    // Snare on beats 5 and 13
    demoPattern[1][4] = true;
    demoPattern[1][12] = true;
    
    // Hi-hat on every 2nd beat
    for (let i = 0; i < STEPS; i += 2) {
      demoPattern[2][i] = true;
    }
    
    // Blip with a simple melody
    demoPattern[3][2] = true;
    demoPattern[3][6] = true;
    demoPattern[3][10] = true;
    demoPattern[3][14] = true;
    
    setSequence(demoPattern);
  }, []);

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
                  onValueChange={([value]) => handleBpmChange(value)}
                  className="flex-1"
                />
              </div>
              
              <div className="flex gap-2">
                <Button
                  className="gba-button text-xs flex-1"
                  size="sm"
                  onClick={clearPatterns}
                >
                  Clear
                </Button>
                <Button
                  className="gba-button text-xs flex-1"
                  size="sm"
                  onClick={generateDemoPattern}
                >
                  Demo Pattern
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
            </div>
          </div>

          <div className="space-y-2">
            {sequence.map((track, trackIndex) => (
              <div key={trackIndex} className="flex items-center gap-2">
                <div className="w-16 text-xs text-[--gba-lightest] font-bold">
                  {TRACK_SOUNDS[trackIndex] || `Track ${trackIndex + 1}`}
                </div>
                <Track
                  track={track}
                  currentStep={currentStep}
                  trackColor={GBA_COLORS[trackIndex % GBA_COLORS.length]}
                  onToggleStep={(stepIndex) => toggleStep(trackIndex, stepIndex)}
                />
              </div>
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="effects" className="p-2 bg-[--gba-dark] rounded-md">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="reverb" className="text-[--gba-lightest]">Reverb</Label>
                  <span className="text-xs text-[--gba-lightest]">
                    {Math.round(reverbAmount * 100)}%
                  </span>
                </div>
                <Slider
                  id="reverb"
                  value={[reverbAmount * 100]}
                  min={0}
                  max={100}
                  step={1}
                  onValueChange={([value]) => setReverbAmountState(value / 100)}
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="delay" className="text-[--gba-lightest]">Delay</Label>
                  <span className="text-xs text-[--gba-lightest]">
                    {Math.round(delayAmount * 100)}%
                  </span>
                </div>
                <Slider
                  id="delay"
                  value={[delayAmount * 100]}
                  min={0}
                  max={100}
                  step={1}
                  onValueChange={([value]) => setDelayAmountState(value / 100)}
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="distortion" className="text-[--gba-lightest]">Distortion</Label>
                  <span className="text-xs text-[--gba-lightest]">
                    {Math.round(distortionAmount * 100)}%
                  </span>
                </div>
                <Slider
                  id="distortion"
                  value={[distortionAmount * 100]}
                  min={0}
                  max={100}
                  step={1}
                  onValueChange={([value]) => setDistortionAmountState(value / 100)}
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="bitcrush" className="text-[--gba-lightest]">Bit Crush</Label>
                  <span className="text-xs text-[--gba-lightest]">
                    {Math.round(bitCrushAmount * 100)}%
                  </span>
                </div>
                <Slider
                  id="bitcrush"
                  value={[bitCrushAmount * 100]}
                  min={0}
                  max={100}
                  step={1}
                  onValueChange={([value]) => setBitCrushAmountState(value / 100)}
                />
              </div>
            </div>
            
            <div className="flex justify-center mt-4">
              <Button
                className="gba-button"
                onClick={() => {
                  // Reset effects to default
                  setReverbAmountState(0.3);
                  setDelayAmountState(0.2);
                  setDistortionAmountState(0.1);
                  setBitCrushAmountState(0.4);
                }}
              >
                Reset Effects
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
}
