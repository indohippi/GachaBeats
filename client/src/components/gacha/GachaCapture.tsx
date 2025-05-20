import React, { useState, useEffect, useRef } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { useToast } from '@/hooks/use-toast';

interface Sound {
  id: number;
  name: string;
  rarity: string;
  url: string;
}

// Generate GBA-styled machine SVG inline
const MachineSVG = () => (
  <svg width="100%" height="100%" viewBox="0 0 400 500" className="machine">
    <rect x="50" y="100" width="300" height="300" rx="15" fill="#8a60c4" stroke="#5e3a8d" strokeWidth="8" />
    <rect x="80" y="140" width="240" height="160" rx="5" fill="#e288bb" />
    <rect x="80" y="320" width="240" height="40" rx="5" fill="#9a74e3" />
    <rect x="120" y="335" width="160" height="15" rx="5" fill="#f9c846" />
    <circle cx="200" cy="220" r="70" fill="#9be7ff" stroke="#5e3a8d" strokeWidth="5" />
    <rect x="40" y="370" width="30" height="100" rx="5" fill="#f9c846" stroke="#5e3a8d" strokeWidth="4" />
    <rect x="35" y="350" width="40" height="30" rx="5" fill="#f06e5b" stroke="#5e3a8d" strokeWidth="4" />
  </svg>
);

const HandleSVG = () => (
  <svg width="40" height="120" viewBox="0 0 40 120" className="handle">
    <rect x="5" y="5" width="30" height="110" rx="10" fill="#ff7676" stroke="#5e3a8d" strokeWidth="4" />
    <circle cx="20" cy="25" r="15" fill="#ffde59" stroke="#5e3a8d" strokeWidth="4" />
  </svg>
);

const PointerSVG = () => (
  <svg width="50" height="60" viewBox="0 0 50 60" className="pointer">
    <path d="M10,10 L40,30 L10,50 Z" fill="#ffde59" stroke="#5e3a8d" strokeWidth="3" />
  </svg>
);

const BallSVG = ({ color1 = '#6ba4ff', color2 = '#ff8ff6', outline = '#4c3fc2' }) => (
  <svg width="60" height="60" viewBox="0 0 60 60" className="ball">
    <circle cx="30" cy="30" r="28" fill={color1} stroke={outline} strokeWidth="4" />
    <circle cx="20" cy="35" r="28" fill={color2} opacity="0.7" />
  </svg>
);

export default function GachaCapture() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPrize, setCurrentPrize] = useState<Sound | null>(null);
  const [showPrize, setShowPrize] = useState(false);
  const [ballsArray, setBallsArray] = useState<Array<{id: number, color1: string, color2: string, outline: string}>>([]);
  const [prizeBall, setPrizeBall] = useState<{id: number, color1: string, color2: string, outline: string} | null>(null);
  const machineRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Initialize balls in the machine
  useEffect(() => {
    const colors = [
      { color1: '#6ba4ff', color2: '#a2f0ff', outline: '#4c3fc2' },
      { color1: '#ff7e7e', color2: '#ffb8b8', outline: '#c23f3f' },
      { color1: '#b4ff7e', color2: '#e0ffb8', outline: '#7ac23f' },
      { color1: '#ffdd7e', color2: '#fff6b8', outline: '#c2a03f' },
      { color1: '#d77eff', color2: '#f0b8ff', outline: '#9c3fc2' },
    ];
    
    // Create array of balls
    const newBalls = Array(8).fill(null).map((_, index) => ({
      id: index,
      ...colors[Math.floor(Math.random() * colors.length)]
    }));
    
    setBallsArray(newBalls);
    
    // Select a random ball to be the prize
    const prizeIndex = Math.floor(Math.random() * newBalls.length);
    setPrizeBall(newBalls[prizeIndex]);
    
  }, []);

  // Placeholder function to get a random sound when gacha is played
  const getRandomSound = (): Sound => {
    const sounds = [
      { id: 1, name: 'GBA Kick', rarity: 'Common', url: '/samples/kick.wav' },
      { id: 2, name: 'Epic Bass', rarity: 'Rare', url: '/samples/bass.wav' },
      { id: 3, name: 'Retro Lead', rarity: 'Uncommon', url: '/samples/lead.wav' },
      { id: 4, name: 'Chiptune Synth', rarity: 'Ultra Rare', url: '/samples/synth.wav' },
      { id: 5, name: 'Lo-Fi Piano', rarity: 'Legendary', url: '/samples/piano.wav' },
    ];
    
    return sounds[Math.floor(Math.random() * sounds.length)];
  };

  const handlePlay = () => {
    if (isPlaying) return;
    
    setIsPlaying(true);
    
    // Simulate gacha animation timing
    setTimeout(() => {
      const prize = getRandomSound();
      setCurrentPrize(prize);
      
      // Show confetti and prize after a delay
      setTimeout(() => {
        setShowPrize(true);
        
        toast({
          title: "New Sound Unlocked!",
          description: `You got ${prize.name} (${prize.rarity})`,
          duration: 5000,
        });
      }, 1500);
    }, 2000);
  };

  const resetGacha = () => {
    setIsPlaying(false);
    setShowPrize(false);
    setCurrentPrize(null);
  };

  return (
    <Card className="gba-pixel-border w-full h-full bg-[--gba-darker] overflow-hidden relative">
      <div className="gacha-container h-full w-full flex flex-col items-center justify-center relative">
        
        {/* Game Layer */}
        <div className={`game-layer w-full h-full flex items-center justify-center relative ${showPrize ? 'dim' : ''}`}>
          <div className="machine-container relative" ref={machineRef}>
            {/* Backboard */}
            <div className="backboard absolute z-0 w-[40%] h-[25%] top-[55%] left-[30%] bg-[#e288bb] rounded-sm"></div>
            
            {/* Machine SVG */}
            <MachineSVG />
            
            {/* Balls Container */}
            <div className="balls-container absolute top-[25%] left-[20%] w-[60%] h-[30%] flex flex-wrap justify-center items-center">
              {ballsArray.map((ball) => (
                <div 
                  key={ball.id} 
                  className="ball-wrapper relative" 
                  style={{
                    transform: `translate(${Math.random() * 20 - 10}px, ${Math.random() * 20 - 10}px) rotate(${Math.random() * 30 - 15}deg)`,
                    transition: 'transform 0.5s ease-in-out',
                    margin: '2px'
                  }}
                >
                  <BallSVG color1={ball.color1} color2={ball.color2} outline={ball.outline} />
                </div>
              ))}
            </div>
            
            {/* Title */}
            <div 
              className="title absolute top-[10%] w-full text-center text-[4vh] text-[#ffc7e5] font-bold z-10"
              style={{
                textShadow: '0px 0px 2px #ad8bd6, 0px 0px 2px #ad8bd6, 0px 0px 2px #ad8bd6, 0px 0px 2px #ad8bd6'
              }}
            >
              {Array.from('がんばれ!').map((char, i) => (
                <span 
                  key={i} 
                  style={{
                    animation: `blink 0.8s linear both infinite ${i * 0.12}s`,
                    display: 'inline-block'
                  }}
                >
                  {char}
                </span>
              ))}
            </div>
            
            {/* Price */}
            <div className="price absolute z-10 top-[80%] left-[15%] text-[#fb91c9] text-[2vh] font-bold">
              100 coins
            </div>
            
            {/* Handle */}
            <div 
              className={`handle-container absolute z-10 left-[13%] top-[70%] cursor-pointer ${isPlaying ? 'playing' : ''}`}
              onClick={!isPlaying ? handlePlay : undefined}
              style={{
                transform: isPlaying ? 'rotate(90deg)' : 'rotate(0deg)',
                transformOrigin: 'top center',
                transition: 'transform 0.3s ease-in-out'
              }}
            >
              <HandleSVG />
            </div>
            
            {/* Pointer */}
            <div 
              className={`pointer-container absolute top-[75%] left-[15%] z-10 pointer-events-none ${!isPlaying ? 'animate-bounce' : 'opacity-0'}`}
              style={{ animation: !isPlaying ? 'click 1s ease-in-out infinite both' : 'none' }}
            >
              <PointerSVG />
            </div>
          </div>
        </div>
        
        {/* UI Layer */}
        <div className="ui-layer absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          {/* Title Container */}
          <div className="title-container absolute top-0 left-0 w-full h-full overflow-hidden z-10">
            <div className={`title flex items-center justify-center w-full h-[20%] ${!isPlaying ? 'translate-y-full' : 'translate-y-0'}`}>
              <h2 
                className="text-center text-[3vh] font-bold"
                style={{
                  textShadow: '0px 0px 2px #f06e5b, 0px 0px 2px #f06e5b, 0px 0px 2px #f06e5b, 0px 0px 2px #f06e5b',
                  animation: 'wiggle 2s ease-in-out infinite both'
                }}
              >
                {!showPrize ? 'Tap to get a prize!' : `You got ${currentPrize?.name}!`}
              </h2>
            </div>
          </div>
          
          {/* Prize Container */}
          <div className="prize-container absolute top-0 left-0 w-full h-full overflow-hidden">
            {/* Prize Ball Container */}
            <div className="prize-ball-container absolute top-0 left-0 w-full h-full overflow-hidden">
              {showPrize && prizeBall && (
                <div 
                  className="prize-ball absolute top-[50%] left-[50%] transform -translate-x-1/2 -translate-y-1/2 scale-[2] opacity-0"
                  style={{ animation: 'fade-in 0.5s forwards' }}
                >
                  <BallSVG color1={prizeBall.color1} color2={prizeBall.color2} outline={prizeBall.outline} />
                </div>
              )}
            </div>
            
            {/* Prize Reward Container */}
            <div className={`prize-reward-container absolute top-0 left-0 w-full h-full flex items-center justify-center ${showPrize ? 'opacity-100' : 'opacity-0'}`} style={{ transition: 'opacity 0.5s ease-in-out' }}>
              {showPrize && currentPrize && (
                <>
                  {/* Shine */}
                  <div className="shine absolute w-full h-full flex items-center justify-center">
                    <div className="w-[80%] h-[80%] rounded-full bg-gradient-to-r from-white to-transparent opacity-30" style={{ animation: 'spin linear 5s infinite forwards' }}></div>
                  </div>
                  
                  {/* Prize */}
                  <div className="prize flex flex-col items-center justify-center gap-4 z-10 pointer-events-auto">
                    <div className="w-[20vh] h-[20vh] bg-[--gba-light] rounded-full flex items-center justify-center wiggle">
                      <span className="text-[6vh] font-bold">🎵</span>
                    </div>
                    <h3 className="text-[3vh] font-bold text-white">{currentPrize.name}</h3>
                    <div className={`rarity px-4 py-1 rounded-full text-black font-bold ${
                      currentPrize.rarity === 'Common' ? 'bg-gray-300' : 
                      currentPrize.rarity === 'Uncommon' ? 'bg-green-300' : 
                      currentPrize.rarity === 'Rare' ? 'bg-blue-300' :
                      currentPrize.rarity === 'Ultra Rare' ? 'bg-purple-300' : 'bg-yellow-300'
                    }`}>
                      {currentPrize.rarity}
                    </div>
                    <Button 
                      className="mt-4 gba-button pointer-events-auto"
                      onClick={resetGacha}
                    >
                      Play Again
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        
      </div>
      
      {/* Custom styles are now in external CSS */}
    </Card>
  );
}