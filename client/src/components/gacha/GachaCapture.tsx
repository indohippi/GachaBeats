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

// Generate styled machine SVG inline matching reference design
const MachineSVG = () => (
  <svg width="300" height="300" viewBox="0 0 300 300" className="machine">
    <rect x="25" y="25" width="250" height="250" rx="15" fill="#8a60c4" stroke="#5e3a8d" strokeWidth="8" />
    <rect x="45" y="45" width="210" height="150" rx="5" fill="#e288bb" />
    <rect x="45" y="200" width="210" height="45" rx="5" fill="#9a74e3" />
    <rect x="65" y="215" width="170" height="20" rx="5" fill="#f9c846" />
    <circle cx="150" cy="120" r="65" fill="#333" stroke="#5e3a8d" strokeWidth="5" />
    <circle cx="150" cy="120" r="60" fill="#444" strokeWidth="0" />
  </svg>
);

const HandleSVG = () => (
  <svg width="40" height="100" viewBox="0 0 40 100" className="handle">
    <rect x="5" y="10" width="30" height="90" rx="10" fill="#ff7676" stroke="#5e3a8d" strokeWidth="4" />
    <circle cx="20" cy="20" r="15" fill="#ffde59" stroke="#5e3a8d" strokeWidth="4" />
  </svg>
);

const PointerSVG = () => (
  <svg width="40" height="50" viewBox="0 0 40 50" className="pointer">
    <path d="M5,5 L35,25 L5,45 Z" fill="#ffde59" stroke="#5e3a8d" strokeWidth="3" />
  </svg>
);

const BallSVG = ({ color1 = '#6ba4ff', color2 = '#ff8ff6', outline = '#4c3fc2' }) => (
  <svg width="50" height="50" viewBox="0 0 50 50" className="ball">
    <circle cx="25" cy="25" r="22" fill={color1} stroke={outline} strokeWidth="3" />
    <circle cx="18" cy="27" r="22" fill={color2} opacity="0.7" />
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

  // Function to get a random sound when gacha is played
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
    
    // Animate one ball dropping down
    const prizeBallIndex = 4; // Use middle ball
    setTimeout(() => {
      // Get the chosen ball element and animate it
      const ballElements = document.querySelectorAll('.ball-wrapper');
      if (ballElements[prizeBallIndex]) {
        const ball = ballElements[prizeBallIndex] as HTMLElement;
        
        // First move slightly left/right
        ball.style.transform = 'translateX(-5px) rotate(-10deg)';
        ball.style.zIndex = '10';
        
        setTimeout(() => {
          // Then drop down
          ball.style.top = '80%';
          ball.style.transition = 'top 0.5s ease-in';
          
          setTimeout(() => {
            // Small bounce
            ball.style.top = '78%';
            ball.style.transition = 'top 0.2s ease-out';
            
            setTimeout(() => {
              // Final position
              ball.style.top = '80%';
              ball.style.transition = 'top 0.2s ease-in';
              
              // Get prize after ball drops
              const prize = getRandomSound();
              setCurrentPrize(prize);
              
              // Show prize after final animation
              setTimeout(() => {
                setShowPrize(true);
                
                toast({
                  title: "New Sound Unlocked!",
                  description: `You got ${prize.name} (${prize.rarity})`,
                  duration: 5000,
                });
              }, 600);
            }, 200);
          }, 500);
        }, 300);
      }
    }, 500);
  };

  const resetGacha = () => {
    setIsPlaying(false);
    setShowPrize(false);
    setCurrentPrize(null);
  };

  return (
    <Card className="gba-pixel-border w-full h-full bg-[--gba-darker] overflow-hidden relative">
      <div className="gacha-container h-full w-full flex flex-col items-center justify-center relative">
        {/* Center everything properly following the reference design */}
        <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center">
          {/* Game Layer - using reference layout */}
          <div className={`game-layer w-full h-full flex items-center justify-center ${showPrize ? 'dim' : ''}`}>
            <div className="machine-container relative w-[320px] h-[400px]" ref={machineRef}>
              {/* Backboard - positioned like the reference */}
              <div className="backboard absolute z-0 w-[100px] h-[80px] top-[65%] left-[48%] bg-[#e288bb] rounded-sm"></div>
              
              {/* Machine SVG */}
              <div className="machine-wrapper relative max-h-[80vh] pointer-events-none">
                <MachineSVG />
              </div>
              
              {/* Balls Container - positioned inside the circle */}
              <div className="balls-container absolute top-[15%] left-[25%] w-[50%] h-[30%] flex flex-wrap justify-center items-center">
                {ballsArray.map((ball, index) => {
                  // Calculate position in a circular pattern
                  const angle = (index / ballsArray.length) * 2 * Math.PI;
                  const radius = 20; // % of container
                  const xPos = 50 + radius * Math.cos(angle);
                  const yPos = 50 + radius * Math.sin(angle);
                  
                  return (
                    <div 
                      key={ball.id} 
                      className="ball-wrapper absolute" 
                      style={{
                        top: `${yPos}%`,
                        left: `${xPos}%`,
                        transform: `rotate(${Math.random() * 30 - 15}deg)`,
                        transition: 'transform 0.3s ease-in-out, top 0.5s ease-in-out',
                        margin: '2px',
                        zIndex: isPlaying && index === 4 ? 5 : 1
                      }}
                    >
                      <BallSVG color1={ball.color1} color2={ball.color2} outline={ball.outline} />
                    </div>
                  );
                })}
              </div>
              
              {/* Title - matching the style of reference */}
              <div 
                className="title absolute top-[8%] w-full text-center text-[22px] text-[#ffc7e5] font-bold z-10"
                style={{
                  textShadow: '0px 0px 2px #ad8bd6, 0px 0px 2px #ad8bd6, 0px 0px 2px #ad8bd6, 0px 0px 2px #ad8bd6'
                }}
              >
                {Array.from('Sound Gacha!').map((char, i) => (
                  <span 
                    key={i} 
                    style={{
                      animation: `blink 0.8s linear both infinite ${i * 0.12}s`,
                      display: 'inline-block',
                      margin: '0 1px'
                    }}
                  >
                    {char}
                  </span>
                ))}
              </div>
              
              {/* Price - positioned like reference */}
              <div className="price absolute z-10 top-[80%] left-[40%] text-[16px] text-[#fb91c9] font-bold">
                50 coins
              </div>
              
              {/* Handle - fixed position */}
              <div 
                className={`handle-container absolute z-10 left-[8%] top-[65%] cursor-pointer ${isPlaying ? 'playing' : ''}`}
                onClick={!isPlaying ? handlePlay : undefined}
                style={{
                  transform: isPlaying ? 'rotate(90deg)' : 'rotate(0deg)',
                  transformOrigin: 'top center',
                  transition: 'transform 0.3s ease-in-out'
                }}
              >
                <HandleSVG />
              </div>
              
              {/* Handle animation */}
              <div 
                className={`handle-animation absolute top-[67%] left-[12%] z-20 pointer-events-none ${!isPlaying ? '' : 'opacity-0'}`}
              >
                <div className="pointer" style={{ animation: !isPlaying ? 'click 1.5s ease-in-out infinite both' : 'none' }}>
                  <svg width="30" height="30" viewBox="0 0 30 30">
                    <path d="M5,5 L25,15 L5,25 Z" fill="#ffde59" stroke="#5e3a8d" strokeWidth="2" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
          
          {/* UI Layer - Following reference design */}
          <div className="ui-layer absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
            {/* Title Container */}
            <div className="title-container absolute top-0 left-0 w-full h-full overflow-hidden z-10">
              <div className={`title flex items-center justify-center w-full h-full ${!isPlaying ? 'translate-y-[80vh]' : 'translate-y-0'}`}
                   style={{ transition: 'transform 0.5s ease-in-out' }}>
                <h2 
                  className="text-center text-[24px] font-bold text-white wiggle"
                  style={{
                    textShadow: '0px 0px 2px #f06e5b, 0px 0px 2px #f06e5b, 0px 0px 2px #f06e5b, 0px 0px 2px #f06e5b'
                  }}
                >
                  {!showPrize ? 'Pull the lever to get a sound!' : `You got ${currentPrize?.name}!`}
                </h2>
              </div>
            </div>
            
            {/* Prize Container - Following reference */}
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
              
              {/* Prize Reward Container - Matching reference */}
              <div className={`prize-reward-container absolute top-0 left-0 w-full h-full flex items-center justify-center ${showPrize ? 'opacity-100' : 'opacity-0'}`} style={{ transition: 'opacity 0.5s ease-in-out' }}>
                {showPrize && currentPrize && (
                  <>
                    {/* Shine */}
                    <div className="shine absolute w-full h-full flex items-center justify-center">
                      <div className="w-full h-full rounded-full bg-gradient-to-r from-white to-transparent opacity-30" style={{ animation: 'spin linear 5s infinite forwards' }}></div>
                    </div>
                    
                    {/* Prize - Styled like reference */}
                    <div className="prize flex flex-col items-center justify-center gap-4 z-10 pointer-events-auto">
                      <div className="w-[120px] h-[120px] bg-[--gba-light] rounded-full flex items-center justify-center wiggle shadow-lg">
                        <span className="text-[60px] font-bold">🎵</span>
                      </div>
                      <h3 className="text-[28px] font-bold text-white mt-2">{currentPrize.name}</h3>
                      <div className={`rarity px-6 py-2 rounded-full text-black font-bold text-[18px] ${
                        currentPrize.rarity === 'Common' ? 'bg-gray-300' : 
                        currentPrize.rarity === 'Uncommon' ? 'bg-green-300' : 
                        currentPrize.rarity === 'Rare' ? 'bg-blue-300' :
                        currentPrize.rarity === 'Ultra Rare' ? 'bg-purple-300' : 'bg-yellow-300'
                      }`}>
                        {currentPrize.rarity}
                      </div>
                      <Button 
                        className="mt-6 gba-button pointer-events-auto px-6 py-3 text-lg"
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
      </div>
    </Card>
  );
}