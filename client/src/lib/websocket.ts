interface WebSocketHandlers {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onMessage?: (data: any) => void;
}

export const setupWebSocket = (handlers: WebSocketHandlers) => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

  ws.onopen = () => {
    handlers.onConnect?.();
  };

  ws.onclose = () => {
    handlers.onDisconnect?.();
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handlers.onMessage?.(data);
    } catch (err) {
      console.error('WebSocket message parse error:', err);
    }
  };

  return ws;
};
