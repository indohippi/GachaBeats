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

  // Store sequencer component reference to sync pattern updates
  const sequencerRef = useRef<any>(null);
  
  // Create reference for connectionId so we can access it in callbacks
  const connectionIdRef = useRef<string | null>(null);
  
  const connect = useCallback((): ReturnType<typeof setupWebSocket> => {
    console.log(`Attempting WebSocket connection (attempt ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`);
    
    return setupWebSocket({
      onConnect: () => {
        console.log('WebSocket connected successfully');
        setConnected(true);
        setReconnectAttempts(0);
        toast({
          title: "Connected",
          description: "Successfully connected to multiplayer session",
        });
      },
      onDisconnect: () => {
        console.log('WebSocket disconnected');
        setConnected(false);
        connectionIdRef.current = null;
        
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
      },
      onMessage: (data) => {
        // Store connection ID when we receive it
        if (data.type === 'connected' && data.connectionId) {
          connectionIdRef.current = data.connectionId;
          console.log(`Received connection ID: ${data.connectionId}`);
        }
        
        // Handle sequencer updates from other clients
        if (data.type === 'sequencer_update' && 
            data.sourceClient !== connectionIdRef.current && 
            sequencerRef.current) {
          console.log(`Received sequencer update from ${data.sourceClient}`);
          
          // Update the sequencer with the new pattern data
          // This requires the Sequencer component to expose an update method
          sequencerRef.current.updatePatternFromRemote?.(data.sequenceData);
        }
        
        // Handle preset changes from other clients
        if (data.type === 'preset_change' && 
            data.sourceClient !== connectionIdRef.current && 
            sequencerRef.current) {
          console.log(`Received preset change to "${data.presetName}" from ${data.sourceClient}`);
          
          // Apply the preset change
          sequencerRef.current.loadPresetFromRemote?.(data.presetName);
          
          toast({
            title: "Preset Changed",
            description: `Another player changed the pattern to "${data.presetName}"`,
          });
        }
        
        // Handle step toggle events from other clients  
        if (data.type === 'toggle_step' && 
            data.sourceClient !== connectionIdRef.current && 
            sequencerRef.current) {
          console.log(`Received step toggle at [${data.trackIndex},${data.stepIndex}] from ${data.sourceClient}`);
          
          // Apply the step toggle
          sequencerRef.current.toggleStepFromRemote?.(data.trackIndex, data.stepIndex);
        }
      }
    });
  }, [reconnectAttempts, toast]);

  // Set up real WebSocket connection
  useEffect(() => {
    // Don't attempt connection until audio is initialized
    if (!audioInitialized) {
      console.log('Delaying WebSocket connection until audio is initialized');
      return;
    }

    // Clear any existing connections
    if (wsRef.current) {
      console.log('Closing existing WebSocket connection before creating a new one');
      wsRef.current.close();
    }
    
    // Create a new connection
    console.log('Creating new WebSocket connection');
    wsRef.current = connect();
    
    // Clean up on unmount
    return () => {
      if (wsRef.current) {
        console.log('Cleaning up WebSocket connection on component unmount');
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect, audioInitialized]);

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
            <Sequencer 
              ref={sequencerRef}
              websocket={wsRef.current}
              isConnected={connected}
              connectionId={connectionIdRef.current || undefined}
            />
          </div>
          <div>
            <GachaSystem />
          </div>
        </div>
      </Card>
    </div>
  );
}
