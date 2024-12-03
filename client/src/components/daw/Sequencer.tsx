import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import Track from './Track';
import { playNote, stopNote } from './AudioEngine';

const STEPS = 16;
const TRACKS = 4;

export default function Sequencer() {
  const [playing, setPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [bpm, setBpm] = useState(120);
  const [sequence, setSequence] = useState(
    Array(TRACKS).fill(Array(STEPS).fill(false))
  );

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (playing) {
      const stepTime = (60 * 1000) / (bpm * 4);
      interval = setInterval(() => {
        setCurrentStep((step) => (step + 1) % STEPS);
        sequence.forEach((track, trackIndex) => {
          if (track[currentStep]) {
            playNote(440 * (trackIndex + 1));
          } else {
            stopNote();
          }
        });
      }, stepTime);
    }

    return () => clearInterval(interval);
  }, [playing, bpm, currentStep, sequence]);

  const toggleStep = (trackIndex: number, stepIndex: number) => {
    setSequence(seq => 
      seq.map((track, tIndex) =>
        tIndex === trackIndex
          ? track.map((step, sIndex) =>
              sIndex === stepIndex ? !step : step
            )
          : track
      )
    );
  };

  return (
    <Card className="gba-pixel-border p-4">
      <div className="flex items-center gap-4 mb-4">
        <Button
          className="gba-button"
          onClick={() => setPlaying(!playing)}
        >
          {playing ? '⏹️' : '▶️'}
        </Button>
        <div className="flex items-center gap-2">
          <span>BPM:</span>
          <Slider
            value={[bpm]}
            min={60}
            max={200}
            step={1}
            onValueChange={([value]) => setBpm(value)}
            className="w-32"
          />
          <span>{bpm}</span>
        </div>
      </div>

      <div className="space-y-2">
        {sequence.map((track, trackIndex) => (
          <Track
            key={trackIndex}
            track={track}
            currentStep={currentStep}
            onToggleStep={(stepIndex) => toggleStep(trackIndex, stepIndex)}
          />
        ))}
      </div>
    </Card>
  );
}
