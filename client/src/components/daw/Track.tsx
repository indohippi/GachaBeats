import { cn } from "@/lib/utils";

interface TrackProps {
  track: boolean[];
  currentStep: number;
  onToggleStep: (step: number) => void;
}

export default function Track({ track, currentStep, onToggleStep }: TrackProps) {
  return (
    <div className="sequencer-grid">
      {track.map((active, step) => (
        <div
          key={step}
          onClick={() => onToggleStep(step)}
          className={cn(
            "grid-cell",
            active && "active",
            step === currentStep && "border-2 border-[--gba-lightest]"
          )}
        />
      ))}
    </div>
  );
}
