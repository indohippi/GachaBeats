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
}

// WebSocket connection constants
const INITIAL_RETRY_DELAY = 500; // 500ms initial delay
const MAX_RETRY_DELAY = 30000; // 30 seconds maximum delay
const HEARTBEAT_INTERVAL = 15000; // 15 seconds
const JITTER_MAX = 0.1; // 10% maximum jitter factor
const CONNECTION_TIMEOUT = 10000; // 10 seconds connection timeout
const MAX_RECONNECT_ATTEMPTS = 5; // Maximum number of reconnection attempts

// Connection states
type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'failed';

// Enhanced WebSocket state tracking
interface EnhancedWebSocketState extends WebSocketState {
  connectionState: ConnectionState;
  lastError?: Error;
  reconnectTimer?: NodeJS.Timeout;
  heartbeatTimer?: NodeJS.Timeout;
}

export const setupWebSocket = (handlers: WebSocketHandlers) => {
  let ws: WebSocket | null = null;
  let heartbeatInterval: NodeJS.Timeout;
  let reconnectTimeout: NodeJS.Timeout;
  
  const state: WebSocketState = {
    isConnected: false,
    lastMessageTime: Date.now(),
    reconnectAttempts: 0,
    maxReconnectAttempts: 5
  };

  const clearTimers = () => {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    if (reconnectTimeout) clearTimeout(reconnectTimeout);
  };

  const connect = () => {
    clearTimers();
    
    if (state.reconnectAttempts >= state.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      handlers.onError?.('Max reconnection attempts reached');
      return;
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      setupEventHandlers(ws);
    } catch (error) {
      console.error('WebSocket connection error:', error);
      scheduleReconnect();
    }
  };

  const setupEventHandlers = (socket: WebSocket) => {
    socket.onopen = () => {
      console.log('WebSocket connection established');
      state.isConnected = true;
      state.reconnectAttempts = 0;
      state.lastMessageTime = Date.now();
      handlers.onConnect?.();

      // Setup heartbeat
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

    socket.onclose = (event) => {
      console.log(`WebSocket closed with code ${event.code}${event.reason ? ': ' + event.reason : ''}`);
      state.isConnected = false;
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
        
        // Handle special message types
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
          error: error instanceof Error ? error.message : 'Unknown error',
          data: event.data
        });
      }
    };
  };

  const scheduleReconnect = () => {
    // Calculate base delay with exponential backoff
    const baseDelay = Math.min(
      INITIAL_RETRY_DELAY * Math.pow(2, state.reconnectAttempts),
      MAX_RETRY_DELAY
    );
    
    // Add jitter to prevent thundering herd problem
    const jitter = baseDelay * JITTER_MAX * (Math.random() * 2 - 1);
    const retryDelay = Math.max(INITIAL_RETRY_DELAY, baseDelay + jitter);

    console.log(`Scheduling reconnect attempt ${state.reconnectAttempts + 1} in ${retryDelay.toFixed(0)}ms (base: ${baseDelay}ms, jitter: ${jitter.toFixed(0)}ms)`);
    
    reconnectTimeout = setTimeout(() => {
      state.reconnectAttempts++;
      
      // Attempt to recover previous connection state if available
      const recoveryState = {
        connectionId: state.connectionId,
        lastMessageTime: state.lastMessageTime,
        pendingMessages: [] // To be implemented: track unsent messages
      };
      
      connect(recoveryState);
    }, retryDelay);
  };

  // Initial connection
  connect();

  // Return cleanup function
  return {
    disconnect: () => {
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
    }
  };
};
