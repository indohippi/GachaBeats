import { cn } from "@/lib/utils";

interface TrackProps {
  track: boolean[];
  currentStep: number;
  trackColor?: string;
  onToggleStep: (step: number) => void;
}

export default function Track({ track, currentStep, trackColor, onToggleStep }: TrackProps) {
  return (
    <div className="sequencer-grid flex-1 grid gap-1" style={{ gridTemplateColumns: 'repeat(16, minmax(0, 1fr))' }}>
      {track.map((active, step) => (
        <div
          key={step}
          onClick={() => onToggleStep(step)}
          className={cn(
            "grid-cell w-full aspect-square rounded-sm cursor-pointer transition-all duration-100 border border-[--gba-light] flex items-center justify-center",
            active ? "bg-opacity-80" : "bg-[--gba-dark] bg-opacity-50 hover:bg-opacity-70",
            step === currentStep && "ring-2 ring-[--gba-lightest]"
          )}
          style={{
            backgroundColor: active ? trackColor || '#8bac0f' : undefined,
          }}
        >
          {active && step === currentStep && (
            <div className="w-2 h-2 rounded-full bg-[--gba-lightest] animate-pulse" />
          )}
        </div>
      ))}
    </div>
  );
}
