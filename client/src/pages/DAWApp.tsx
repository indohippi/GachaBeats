import { useEffect, useState, useCallback, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import Sequencer from '../components/daw/Sequencer';
import GachaSystem from '../components/gacha/GachaSystem';
import { setupWebSocket } from '../lib/websocket';
import { initAudioEngine } from '../components/daw/AudioEngine';

// Constants for WebSocket reconnection
const RECONNECT_DELAY = 5000;
const MAX_RECONNECT_ATTEMPTS = 5;

export default function DAWApp() {
  const [connected, setConnected] = useState(false);
  const [audioInitialized, setAudioInitialized] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const { toast } = useToast();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const connect = useCallback(() => {
    console.log(`Attempting WebSocket connection (attempt ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`);
    
    wsRef.current = setupWebSocket({
      onConnect: () => {
        console.log('WebSocket connected successfully');
        setConnected(true);
        setReconnectAttempts(0);
        toast({
          title: "Connected",
          description: "Successfully connected to server",
        });
      },
      onDisconnect: () => {
        console.log('WebSocket disconnected');
        setConnected(false);
        
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          toast({
            title: "Connection Lost",
            description: `Reconnecting in ${RECONNECT_DELAY/1000} seconds... (Attempt ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`,
            variant: "destructive",
          });
          
          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
            connect();
          }, RECONNECT_DELAY);
        } else {
          toast({
            title: "Connection Failed",
            description: "Maximum reconnection attempts reached. Please refresh the page.",
            variant: "destructive",
          });
        }
      },
      onError: (error) => {
        console.error('WebSocket error:', error);
        toast({
          title: "Connection Error",
          description: "Failed to connect to server",
          variant: "destructive",
        });
      }
    });
  }, [reconnectAttempts, toast]);

  useEffect(() => {
    connect();
    return () => {
      console.log('Cleaning up WebSocket connection');
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const handleInitAudio = async () => {
    console.log('Initializing audio system...');
    try {
      await initAudioEngine();
      console.log('Audio system initialized successfully');
      setAudioInitialized(true);
      toast({
        title: "Audio Ready",
        description: "Audio system initialized successfully",
      });
    } catch (err) {
      console.error('Audio initialization error:', err);
      toast({
        title: "Audio Error",
        description: err instanceof Error 
          ? `Failed to initialize audio: ${err.message}`
          : "Failed to initialize audio system",
        variant: "destructive",
      });
    }
  };

  const handleRetryConnection = useCallback(() => {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      setReconnectAttempts(0);
      connect();
    }
  }, [reconnectAttempts, connect]);

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
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm">
                {connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            {!connected && reconnectAttempts >= MAX_RECONNECT_ATTEMPTS && (
              <Button
                className="gba-button text-sm"
                onClick={handleRetryConnection}
              >
                Retry Connection
              </Button>
            )}
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
