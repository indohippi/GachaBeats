// Using browser's native WebSocket, not the 'ws' import
// Browser's WebSocket is already available globally

interface WebSocketHandlers {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onMessage?: (data: any) => void;
  onError?: (error: any) => void;
}

interface WebSocketState {
  connectionId?: string;
  isConnected: boolean;
  lastMessageTime: number;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  connectionState: ConnectionState;
}

// Connection states
type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'failed';

// WebSocket connection constants
const INITIAL_RETRY_DELAY = 1000; // 1 second initial delay
const MAX_RETRY_DELAY = 30000; // 30 seconds maximum delay
const HEARTBEAT_INTERVAL = 15000; // 15 seconds
const CONNECTION_TIMEOUT = 10000; // 10 seconds connection timeout
const JITTER_MAX = 0.1; // 10% maximum jitter factor

// DAW-specific message handlers
export interface SequencerUpdateMessage {
  type: 'sequencer_update';
  sequenceData: boolean[][];
  sourceClient: string;
  timestamp: number;
}

export interface PresetChangeMessage {
  type: 'preset_change';
  presetName: string;
  sourceClient: string;
  timestamp: number;
}

export interface ToggleStepMessage {
  type: 'toggle_step';
  trackIndex: number;
  stepIndex: number;
  sourceClient: string;
  timestamp: number;
}

export type DAWMessage = SequencerUpdateMessage | PresetChangeMessage | ToggleStepMessage;

// Send functions for DAW-specific messages
export const sendSequencerUpdate = (
  socket: WebSocket | null, 
  sequenceData: boolean[][]
) => {
  if (!socket || socket.readyState !== WebSocket.OPEN) return false;
  
  try {
    socket.send(JSON.stringify({
      type: 'sequencer_update',
      sequenceData
    }));
    return true;
  } catch (error) {
    console.error('Failed to send sequencer update:', error);
    return false;
  }
};

export const sendPresetChange = (
  socket: WebSocket | null,
  presetName: string
) => {
  if (!socket || socket.readyState !== WebSocket.OPEN) return false;
  
  try {
    socket.send(JSON.stringify({
      type: 'preset_change',
      presetName
    }));
    return true;
  } catch (error) {
    console.error('Failed to send preset change:', error);
    return false;
  }
};

export const sendToggleStep = (
  socket: WebSocket | null,
  trackIndex: number,
  stepIndex: number
) => {
  if (!socket || socket.readyState !== WebSocket.OPEN) return false;
  
  try {
    socket.send(JSON.stringify({
      type: 'toggle_step',
      trackIndex,
      stepIndex
    }));
    return true;
  } catch (error) {
    console.error('Failed to send step toggle:', error);
    return false;
  }
};

export const setupWebSocket = (handlers: WebSocketHandlers) => {
  let ws: WebSocket | null = null;
  let heartbeatInterval: NodeJS.Timeout;
  let reconnectTimeout: NodeJS.Timeout;
  
  const state: WebSocketState = {
    isConnected: false,
    lastMessageTime: Date.now(),
    reconnectAttempts: 0,
    maxReconnectAttempts: 5,
    connectionState: 'disconnected'
  };

  const clearTimers = () => {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    if (reconnectTimeout) clearTimeout(reconnectTimeout);
  };

  const connect = () => {
    clearTimers();
    
    if (ws?.readyState === WebSocket.CONNECTING) {
      console.log('Already attempting to connect, skipping duplicate attempt');
      return;
    }
    
    if (state.reconnectAttempts >= state.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      state.connectionState = 'failed';
      handlers.onError?.('Max reconnection attempts reached');
      return;
    }

    // Reset connection state
    if (ws) {
      try {
        ws.close();
      } catch (err) {
        console.error('Error closing existing connection:', err);
      }
      ws = null;
    }

    try {
      state.connectionState = 'connecting';
      // Make sure the URL matches the server's expected path exactly
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      
      // Build a full URL with the explicit ws endpoint
      const baseUrl = `${protocol}//${window.location.host}`;
      const url = `${baseUrl}/ws`;
      
      console.log(`Attempting WebSocket connection to ${url}`);
      
      // Create a new WebSocket with the specified URL
      ws = new WebSocket(url);
      ws.binaryType = 'arraybuffer';

      const connectionTimeout = setTimeout(() => {
        if (ws && ws.readyState !== WebSocket.OPEN) {
          console.log('WebSocket connection timeout, closing...');
          ws.close();
          state.connectionState = 'disconnected';
          scheduleReconnect();
        }
      }, CONNECTION_TIMEOUT);

      setupEventHandlers(ws);

      ws.addEventListener('open', () => {
        clearTimeout(connectionTimeout);
      }, { once: true });

    } catch (error) {
      console.error('WebSocket connection error:', error);
      state.connectionState = 'disconnected';
      scheduleReconnect();
    }
  };

  const setupEventHandlers = (socket: WebSocket) => {
    socket.onopen = () => {
      console.log('WebSocket connection established');
      state.isConnected = true;
      state.connectionState = 'connected';
      state.reconnectAttempts = 0;
      state.lastMessageTime = Date.now();
      handlers.onConnect?.();

      heartbeatInterval = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          try {
            socket.send(JSON.stringify({ type: 'ping' }));
          } catch (error) {
            console.error('Failed to send heartbeat:', error);
            socket.close();
          }
        }
      }, HEARTBEAT_INTERVAL);
    };

    socket.onclose = () => {
      console.log('WebSocket connection closed');
      state.isConnected = false;
      state.connectionState = 'disconnected';
      clearTimers();
      handlers.onDisconnect?.();
      scheduleReconnect();
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      handlers.onError?.(error);
    };

    socket.onmessage = (event) => {
      try {
        state.lastMessageTime = Date.now();
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'connected':
            state.connectionId = data.connectionId;
            console.log(`Connected with ID: ${data.connectionId}`);
            break;
          case 'error':
            console.error('Server reported error:', data.message);
            handlers.onError?.(data);
            break;
          case 'pong':
            // Heartbeat response received
            break;
          default:
            handlers.onMessage?.(data);
        }
      } catch (error) {
        console.error('Failed to process WebSocket message:', error);
        handlers.onError?.({
          type: 'message_error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    };
  };

  const scheduleReconnect = () => {
    const baseDelay = Math.min(
      INITIAL_RETRY_DELAY * Math.pow(2, state.reconnectAttempts),
      MAX_RETRY_DELAY
    );
    
    // Add jitter to prevent thundering herd problem
    const jitter = baseDelay * JITTER_MAX * (Math.random() * 2 - 1);
    const retryDelay = Math.max(INITIAL_RETRY_DELAY, baseDelay + jitter);

    console.log(`Scheduling reconnect attempt ${state.reconnectAttempts + 1} in ${retryDelay.toFixed(0)}ms`);
    
    reconnectTimeout = setTimeout(() => {
      state.reconnectAttempts++;
      connect();
    }, retryDelay);
  };

  // Initial connection
  connect();

  return {
    close: () => {
      clearTimers();
      if (ws) {
        ws.close();
        ws = null;
      }
    },
    getState: () => ({ ...state }),
    reconnect: () => {
      state.reconnectAttempts = 0;
      connect();
    },
    // Add methods to access the WebSocket object and send messages
    getSocket: () => ws,
    // DAW-specific message methods
    sendSequencerUpdate: (sequenceData: boolean[][]) => 
      sendSequencerUpdate(ws, sequenceData),
    sendPresetChange: (presetName: string) => 
      sendPresetChange(ws, presetName),
    sendToggleStep: (trackIndex: number, stepIndex: number) =>
      sendToggleStep(ws, trackIndex, stepIndex)
  };
};
