import { config } from '@/config';
import { WebSocketMessage } from '@/types';
import { logger } from '@/utils/logger';
import { redis } from '@/utils/redis';
import { createServer } from 'http';
import WebSocket from 'ws';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  dashboardId?: string;
  isAlive?: boolean;
}

export class WebSocketService {
  private wss: WebSocket.Server;
  private server: any;
  private clients: Map<string, AuthenticatedWebSocket> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.server = createServer();
    this.wss = new WebSocket.Server({
      server: this.server,
      verifyClient: this.verifyClient.bind(this),
    });

    this.setupWebSocketServer();
    this.setupRedisSubscription();
  }

  async start(): Promise<void> {
    return new Promise(resolve => {
      this.server.listen(config.websocket.port, () => {
        logger.info(
          `WebSocket server started on port ${config.websocket.port}`
        );
        this.startHeartbeat();
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.wss.clients.forEach(ws => {
      ws.terminate();
    });

    return new Promise(resolve => {
      this.server.close(() => {
        logger.info('WebSocket server stopped');
        resolve();
      });
    });
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: AuthenticatedWebSocket, _request) => {
      logger.info('New WebSocket connection established');

      ws.isAlive = true;
      ws.on('pong', () => {
        ws.isAlive = true;
      });

      ws.on('message', async data => {
        try {
          const message = JSON.parse(data.toString());
          await this.handleMessage(ws, message);
        } catch (error) {
          logger.error('Failed to parse WebSocket message', { error });
          this.sendError(ws, 'Invalid message format');
        }
      });

      ws.on('close', () => {
        this.handleDisconnection(ws);
      });

      ws.on('error', error => {
        logger.error('WebSocket error', { error });
      });

      // Send welcome message
      this.sendMessage(ws, {
        type: 'heartbeat',
        payload: { status: 'connected' },
        timestamp: new Date(),
      });
    });
  }

  private async setupRedisSubscription(): Promise<void> {
    try {
      await redis.connect();
      const subscriber = redis.getClient().duplicate();
      await subscriber.connect();

      subscriber.subscribe('analytics:updates', message => {
        try {
          const parsedMessage: WebSocketMessage = JSON.parse(message);
          this.broadcastToClients(parsedMessage);
        } catch (error) {
          logger.error('Failed to parse Redis message', { error });
        }
      });

      logger.info('Redis subscription established for analytics updates');
    } catch (error) {
      logger.error('Failed to setup Redis subscription', { error });
    }
  }

  private verifyClient(info: any): boolean {
    // Basic verification - in production, implement proper JWT verification
    const url = new URL(info.req.url, 'http://localhost');
    const token = url.searchParams.get('token');

    if (!token) {
      logger.warn('WebSocket connection rejected: No token provided');
      return false;
    }

    // TODO: Verify JWT token
    return true;
  }

  private async handleMessage(
    ws: AuthenticatedWebSocket,
    message: any
  ): Promise<void> {
    switch (message.type) {
      case 'authenticate':
        await this.handleAuthentication(ws, message.payload);
        break;

      case 'subscribe_dashboard':
        await this.handleDashboardSubscription(ws, message.payload);
        break;

      case 'unsubscribe_dashboard':
        await this.handleDashboardUnsubscription(ws, message.payload);
        break;

      case 'ping':
        this.sendMessage(ws, {
          type: 'pong',
          payload: {},
          timestamp: new Date(),
        });
        break;

      default:
        this.sendError(ws, `Unknown message type: ${message.type}`);
    }
  }

  private async handleAuthentication(
    ws: AuthenticatedWebSocket,
    payload: any
  ): Promise<void> {
    try {
      // TODO: Verify JWT token and extract user ID
      const userId = payload.userId; // This should come from JWT verification

      ws.userId = userId;
      this.clients.set(userId, ws);

      this.sendMessage(ws, {
        type: 'authenticated',
        payload: { userId },
        timestamp: new Date(),
      });

      logger.info('WebSocket client authenticated', { userId });
    } catch (error) {
      logger.error('Authentication failed', { error });
      this.sendError(ws, 'Authentication failed');
    }
  }

  private async handleDashboardSubscription(
    ws: AuthenticatedWebSocket,
    payload: any
  ): Promise<void> {
    try {
      const { dashboardId } = payload;
      ws.dashboardId = dashboardId;

      this.sendMessage(ws, {
        type: 'dashboard_subscribed',
        payload: { dashboardId },
        timestamp: new Date(),
      });

      logger.info('Client subscribed to dashboard', {
        userId: ws.userId,
        dashboardId,
      });
    } catch (error) {
      logger.error('Dashboard subscription failed', { error });
      this.sendError(ws, 'Dashboard subscription failed');
    }
  }

  private async handleDashboardUnsubscription(
    ws: AuthenticatedWebSocket,
    _payload: any
  ): Promise<void> {
    try {
      ws.dashboardId = undefined;

      this.sendMessage(ws, {
        type: 'dashboard_unsubscribed',
        payload: {},
        timestamp: new Date(),
      });

      logger.info('Client unsubscribed from dashboard', { userId: ws.userId });
    } catch (error) {
      logger.error('Dashboard unsubscription failed', { error });
      this.sendError(ws, 'Dashboard unsubscription failed');
    }
  }

  private handleDisconnection(ws: AuthenticatedWebSocket): void {
    if (ws.userId) {
      this.clients.delete(ws.userId);
      logger.info('WebSocket client disconnected', { userId: ws.userId });
    }
  }

  private broadcastToClients(message: WebSocketMessage): void {
    this.wss.clients.forEach((client: AuthenticatedWebSocket) => {
      if (client.readyState === WebSocket.OPEN) {
        // Filter messages based on user permissions and subscriptions
        if (this.shouldSendToClient(client, message)) {
          this.sendMessage(client, message);
        }
      }
    });
  }

  private shouldSendToClient(
    client: AuthenticatedWebSocket,
    message: WebSocketMessage
  ): boolean {
    // Basic filtering logic - expand based on requirements
    if (message.userId && message.userId !== client.userId) {
      return false;
    }

    if (message.dashboardId && message.dashboardId !== client.dashboardId) {
      return false;
    }

    return true;
  }

  private sendMessage(ws: WebSocket, message: WebSocketMessage): void {
    try {
      ws.send(JSON.stringify(message));
    } catch (error) {
      logger.error('Failed to send WebSocket message', { error });
    }
  }

  private sendError(ws: WebSocket, error: string): void {
    this.sendMessage(ws, {
      type: 'error',
      payload: { error },
      timestamp: new Date(),
    });
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws: AuthenticatedWebSocket) => {
        if (ws.isAlive === false) {
          ws.terminate();
          return;
        }

        ws.isAlive = false;
        ws.ping();
      });
    }, config.websocket.heartbeatInterval);
  }

  public async broadcastMetricUpdate(data: any): Promise<void> {
    const message: WebSocketMessage = {
      type: 'metric_update',
      payload: data,
      timestamp: new Date(),
    };

    this.broadcastToClients(message);
  }

  public async broadcastDashboardUpdate(
    dashboardId: string,
    data: any
  ): Promise<void> {
    const message: WebSocketMessage = {
      type: 'dashboard_update',
      payload: data,
      timestamp: new Date(),
      dashboardId,
    };

    this.broadcastToClients(message);
  }

  public async sendAlert(userId: string, alert: any): Promise<void> {
    const client = this.clients.get(userId);
    if (client && client.readyState === WebSocket.OPEN) {
      this.sendMessage(client, {
        type: 'alert',
        payload: alert,
        timestamp: new Date(),
        userId,
      });
    }
  }
}
