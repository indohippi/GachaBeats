import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import GachaCapture from "./GachaCapture";

// Mock Tone.js
vi.mock("tone", () => ({
  Player: vi.fn(() => ({
    toDestination: vi.fn().mockReturnThis(),
    start: vi.fn(),
    stop: vi.fn(),
    dispose: vi.fn(),
  })),
  Reverb: vi.fn(() => ({
    toDestination: vi.fn().mockReturnThis(),
    dispose: vi.fn(),
  })),
}));

describe("GachaCapture", () => {
  const mockPrize = {
    id: 1,
    name: "Test Sound",
    description: "A test sound",
    rarity: "common" as const,
    soundUrl: "/test-sound.mp3",
    category: "drums",
  };

  it("renders capture animation when prize is provided", () => {
    render(<GachaCapture prize={mockPrize} onComplete={vi.fn()} />);
    expect(screen.getByText(/you got/i)).toBeInTheDocument();
  });

  it("calls onComplete after animation", async () => {
    const onComplete = vi.fn();
    render(<GachaCapture prize={mockPrize} onComplete={onComplete} />);

    await waitFor(
      () => {
        expect(onComplete).toHaveBeenCalled();
      },
      { timeout: 6000 }
    );
  });

  it("displays prize information", () => {
    render(<GachaCapture prize={mockPrize} onComplete={vi.fn()} />);
    expect(screen.getByText(mockPrize.name)).toBeInTheDocument();
    expect(screen.getByText(mockPrize.description)).toBeInTheDocument();
  });
});
