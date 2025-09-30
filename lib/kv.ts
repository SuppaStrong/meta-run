import { createClient, RedisClientType } from 'redis';

class KVStore {
  private static instance: KVStore;
  private client: RedisClientType | null = null;
  private connecting: Promise<RedisClientType> | null = null;

  private constructor() {}

  static getInstance(): KVStore {
    if (!KVStore.instance) {
      KVStore.instance = new KVStore();
    }
    return KVStore.instance;
  }

  private async getClient(): Promise<RedisClientType> {
    // Nếu client đã connected, return ngay
    if (this.client && this.client.isOpen) {
      return this.client;
    }

    // Nếu đang connecting, đợi connection đó
    if (this.connecting) {
      return this.connecting;
    }

    // Tạo connection mới
    this.connecting = this.createConnection();
    this.client = await this.connecting;
    this.connecting = null;

    return this.client;
  }

  private async createConnection(): Promise<RedisClientType> {
    const redisUrl = process.env.REDIS_URL;
    
    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is not set');
    }

    const client = createClient({ 
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 3) {
            console.error('[Redis] Too many retries, stopping reconnection');
            return new Error('Too many retries');
          }
          return Math.min(retries * 100, 3000);
        },
        connectTimeout: 10000,
      }
    });

    client.on('error', (err) => {
      console.error('[Redis] Client Error:', err);
    });

    client.on('connect', () => {
      console.log('[Redis] Connected successfully');
    });

    client.on('ready', () => {
      console.log('[Redis] Ready to use');
    });

    await client.connect();
    return client as RedisClientType;
  }

  /**
   * GET - Lấy giá trị từ Redis
   * Tương tự kv.get() của Vercel KV
   */
  async get<T = any>(key: string): Promise<T | null> {
    try {
      const client = await this.getClient();
      const value = await client.get(key);
      
      if (!value) {
        return null;
      }

      return JSON.parse(value) as T;
    } catch (error) {
      console.error(`[Redis] Error getting key ${key}:`, error);
      throw error;
    }
  }

  /**
   * SET - Lưu giá trị vào Redis
   * Tương tự kv.set() của Vercel KV
   */
  async set<T = any>(key: string, value: T): Promise<void> {
    try {
      const client = await this.getClient();
      await client.set(key, JSON.stringify(value));
      console.log(`[Redis] Set key ${key} successfully`);
    } catch (error) {
      console.error(`[Redis] Error setting key ${key}:`, error);
      throw error;
    }
  }

  /**
   * DELETE - Xóa key khỏi Redis
   */
  async del(key: string): Promise<void> {
    try {
      const client = await this.getClient();
      await client.del(key);
      console.log(`[Redis] Deleted key ${key} successfully`);
    } catch (error) {
      console.error(`[Redis] Error deleting key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Disconnect - Đóng connection (cleanup)
   */
  async disconnect(): Promise<void> {
    if (this.client && this.client.isOpen) {
      await this.client.quit();
      this.client = null;
      console.log('[Redis] Disconnected');
    }
  }
}

// Export singleton instance với API giống Vercel KV
export const kv = {
  get: <T = any>(key: string) => KVStore.getInstance().get<T>(key),
  set: <T = any>(key: string, value: T) => KVStore.getInstance().set<T>(key, value),
  del: (key: string) => KVStore.getInstance().del(key),
};