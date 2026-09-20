import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve(process.cwd(), 'data');

export interface Identifiable {
  id?: string;
  userId?: string;
  [key: string]: any;
}

export class JSONStore {
  private static instance: JSONStore;
  private memoryCache: Map<string, any[]> = new Map();
  private writeQueues: Map<string, Promise<void>> = new Map();

  private constructor() {
    this.ensureDataDir();
  }

  public static getInstance(): JSONStore {
    if (!JSONStore.instance) {
      JSONStore.instance = new JSONStore();
    }
    return JSONStore.instance;
  }

  private ensureDataDir(): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private getFilePath(collectionName: string): string {
    return path.join(DATA_DIR, `${collectionName}.json`);
  }

  /**
   * Initializes a collection file if missing or empty with initial Data [].
   */
  public initCollection(collectionName: string, defaultData: any[] = []): void {
    this.ensureDataDir();
    const filePath = this.getFilePath(collectionName);
    if (!fs.existsSync(filePath)) {
      this.writeFileSyncAtomic(filePath, JSON.stringify(defaultData, null, 2));
      this.memoryCache.set(collectionName, defaultData);
    } else {
      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        this.memoryCache.set(collectionName, Array.isArray(parsed) ? parsed : defaultData);
      } catch (err) {
        console.error(`[JSONStore] Error reading ${collectionName}.json, resetting to default:`, err);
        this.writeFileSyncAtomic(filePath, JSON.stringify(defaultData, null, 2));
        this.memoryCache.set(collectionName, defaultData);
      }
    }
  }

  /**
   * Performs an atomic write by writing to a .tmp file first, then synchronously renaming.
   */
  private writeFileSyncAtomic(filePath: string, data: string): void {
    const tempPath = `${filePath}.${Date.now()}.${Math.random().toString(36).substring(2, 8)}.tmp`;
    try {
      fs.writeFileSync(tempPath, data, 'utf-8');
      fs.renameSync(tempPath, filePath);
    } catch (err) {
      if (fs.existsSync(tempPath)) {
        try { fs.unlinkSync(tempPath); } catch (_) {}
      }
      throw err;
    }
  }

  /**
   * Reads all items in a collection.
   */
  public getCollection<T = any>(collectionName: string): T[] {
    if (!this.memoryCache.has(collectionName)) {
      this.initCollection(collectionName, []);
    }
    return (this.memoryCache.get(collectionName) || []) as T[];
  }

  /**
   * Saves the entire array to the JSON file atomically.
   */
  public setCollection<T = any>(collectionName: string, items: T[]): void {
    this.ensureDataDir();
    this.memoryCache.set(collectionName, items);
    const filePath = this.getFilePath(collectionName);
    this.writeFileSyncAtomic(filePath, JSON.stringify(items, null, 2));
  }

  /**
   * Finds items matching a predicate function.
   */
  public find<T = any>(collectionName: string, predicate: (item: T) => boolean): T[] {
    const collection = this.getCollection<T>(collectionName);
    return collection.filter(predicate);
  }

  /**
   * Finds a single item matching a predicate function.
   */
  public findOne<T = any>(collectionName: string, predicate: (item: T) => boolean): T | undefined {
    const collection = this.getCollection<T>(collectionName);
    return collection.find(predicate);
  }

  /**
   * Inserts an item into a collection.
   */
  public insert<T = any>(collectionName: string, item: T): T {
    const collection = this.getCollection<T>(collectionName);
    collection.push(item);
    this.setCollection(collectionName, collection);
    return item;
  }

  /**
   * Updates items matching a predicate function.
   */
  public update<T = any>(collectionName: string, predicate: (item: T) => boolean, updates: Partial<T>): number {
    const collection = this.getCollection<T>(collectionName);
    let updatedCount = 0;
    const nextCollection = collection.map(item => {
      if (predicate(item)) {
        updatedCount++;
        return { ...item, ...updates, updatedAt: new Date().toISOString() };
      }
      return item;
    });
    if (updatedCount > 0) {
      this.setCollection(collectionName, nextCollection);
    }
    return updatedCount;
  }

  /**
   * Deletes items matching a predicate function.
   */
  public delete<T = any>(collectionName: string, predicate: (item: T) => boolean): number {
    const collection = this.getCollection<T>(collectionName);
    const initialLen = collection.length;
    const filtered = collection.filter(item => !predicate(item));
    const deletedCount = initialLen - filtered.length;
    if (deletedCount > 0) {
      this.setCollection(collectionName, filtered);
    }
    return deletedCount;
  }
}

export const jsonStore = JSONStore.getInstance();
