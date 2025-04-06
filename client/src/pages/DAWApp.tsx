import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import Sequencer from '../components/daw/Sequencer';
import GachaSystem from '../components/gacha/GachaSystem';
import { setupWebSocket } from '../lib/websocket';
import { initAudioEngine } from '../components/daw/AudioEngine';

const { useState, useEffect, useCallback, useRef } = React;

// Constants for WebSocket reconnection
const RECONNECT_DELAY = 5000;
const MAX_RECONNECT_ATTEMPTS = 5;

export default function DAWApp() {
  const [connected, setConnected] = useState(false);
  const [audioInitialized, setAudioInitialized] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const { toast } = useToast();
  const wsRef = useRef<ReturnType<typeof setupWebSocket> | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const connect = useCallback((): ReturnType<typeof setupWebSocket> => {
    console.log(`Attempting WebSocket connection (attempt ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`);
    
    return setupWebSocket({
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

  // Simulate connection behavior for development purposes
  useEffect(() => {
    // Don't attempt connection until audio is initialized
    if (!audioInitialized) {
      console.log('Delaying WebSocket connection until audio is initialized');
      return;
    }

    // Simulate a successful connection after a short delay
    const connectionTimeout = setTimeout(() => {
      console.log('Simulating successful WebSocket connection for development');
      setConnected(true);
      setReconnectAttempts(0);
      
      toast({
        title: "Connected",
        description: "Connection established with session id: dev-only-mode",
      });
    }, 1000);
    
    // Clear the timeout on cleanup
    return () => {
      clearTimeout(connectionTimeout);
      setConnected(false);
      setReconnectAttempts(0);
    };
  }, [toast, audioInitialized]);

  const handleInitAudio = async () => {
    console.log('[DAWApp] Starting audio system initialization...');
    const startTime = performance.now();
    
    try {
      await initAudioEngine();
      const initTime = performance.now() - startTime;
      console.log(`[DAWApp] Audio system initialized successfully in ${initTime.toFixed(2)}ms`);
      
      setAudioInitialized(true);
      toast({
        title: "Audio Ready",
        description: "Audio system initialized successfully",
      });
    } catch (err) {
      const errorTime = performance.now() - startTime;
      console.error(`[DAWApp] Audio initialization failed after ${errorTime.toFixed(2)}ms:`, err);
      
      toast({
        title: "Audio Error",
        description: err instanceof Error 
          ? `Failed to initialize audio: ${err.message}`
          : "Failed to initialize audio system",
        variant: "destructive",
      });
      
      // Log additional debug information
      console.debug('[DAWApp] Audio initialization debug info:', {
        browserAudioContext: window.AudioContext,
        userAgent: navigator.userAgent,
        error: err
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
