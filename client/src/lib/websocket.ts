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

const INITIAL_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 30000; // 30 seconds
const HEARTBEAT_INTERVAL = 15000; // 15 seconds

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
    const retryDelay = Math.min(
      INITIAL_RETRY_DELAY * Math.pow(2, state.reconnectAttempts),
      MAX_RETRY_DELAY
    );

    console.log(`Scheduling reconnect attempt ${state.reconnectAttempts + 1} in ${retryDelay}ms`);
    
    reconnectTimeout = setTimeout(() => {
      state.reconnectAttempts++;
      connect();
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
