import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import Sequencer from '../components/daw/Sequencer';
import GachaSystem from '../components/gacha/GachaSystem';
import { setupWebSocket } from '../lib/websocket';
import { initAudioEngine } from '../components/daw/AudioEngine';

export default function DAWApp() {
  const [connected, setConnected] = useState(false);
  const [audioInitialized, setAudioInitialized] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const ws = setupWebSocket({
      onConnect: () => setConnected(true),
      onDisconnect: () => setConnected(false),
    });

    return () => ws.close();
  }, []);

  const handleInitAudio = async () => {
    try {
      await initAudioEngine();
      setAudioInitialized(true);
    } catch (err) {
      toast({
        title: "Audio Error",
        description: "Failed to initialize audio system",
        variant: "destructive",
      });
    }
  };

  if (!audioInitialized) {
    return (
      <div className="flex h-screen items-center justify-center bg-[--gba-darkest]">
        <Button className="gba-button" onClick={handleInitAudio}>
          Start Audio Engine
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <Card className="gba-pixel-border bg-[--gba-darkest] p-4">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-bold text-[--gba-lightest]">GBA DAW</h1>
          <div className="flex gap-2">
            <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm">
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <Sequencer />
          </div>
          <div>
            <GachaSystem />
          </div>
        </div>
      </Card>
    </div>
  );
}
