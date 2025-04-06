import 'express-session';

import { WebSocketServer } from 'ws';

declare module 'express-session' {
  interface SessionData {
    userId: number;
  }
}

declare global {
  var wss: WebSocketServer;
}
