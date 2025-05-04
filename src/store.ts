import { z } from 'zod';

// 定義 MCP 數據的類型
export const MCPItemSchema = z.object({
  id: z.string(),
  type: z.string(),
  content: z.any(),
  tags: z.array(z.string()).optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type MCPItem = z.infer<typeof MCPItemSchema>;

// 記憶空間接口
export interface MemoryStoreInterface {
  add(item: Omit<MCPItem, 'createdAt' | 'updatedAt'>): MCPItem;
  get(id: string): MCPItem | undefined;
  update(id: string, updates: Partial<Omit<MCPItem, 'id' | 'createdAt' | 'updatedAt'>>): MCPItem | undefined;
  delete(id: string): boolean;
  list(options?: { type?: string; tags?: string[]; limit?: number }): MCPItem[];
  clear(): void;
}

/**
 * MCP記憶空間實現，用於儲存和管理MCP相關資訊
 * 使用單例模式確保整個應用中只有一個記憶空間實例
 */
class MemoryStore implements MemoryStoreInterface {
  private static instance: MemoryStore | null = null;
  private items: Map<string, MCPItem> = new Map();

  /**
   * 私有構造函數，防止外部直接創建實例
   */
  private constructor() {}

  /**
   * 獲取 MemoryStore 的單例實例
   * @returns MemoryStore 單例實例
   */
  public static getInstance(): MemoryStore {
    if (!MemoryStore.instance) {
      MemoryStore.instance = new MemoryStore();
    }
    return MemoryStore.instance;
  }

  /**
   * 添加新項目到記憶空間
   * @param item 要添加的項目
   * @returns 添加的項目
   */
  add(item: Omit<MCPItem, 'createdAt' | 'updatedAt'>): MCPItem {
    const timestamp = Date.now();
    const newItem: MCPItem = {
      ...item,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    
    this.items.set(newItem.id, newItem);
    return newItem;
  }

  /**
   * 根據ID獲取項目
   * @param id 項目ID
   * @returns 找到的項目或undefined
   */
  get(id: string): MCPItem | undefined {
    return this.items.get(id);
  }

  /**
   * 更新現有項目
   * @param id 項目ID
   * @param updates 要更新的欄位
   * @returns 更新後的項目或undefined
   */
  update(id: string, updates: Partial<Omit<MCPItem, 'id' | 'createdAt' | 'updatedAt'>>): MCPItem | undefined {
    const item = this.items.get(id);
    if (!item) return undefined;

    const updatedItem: MCPItem = {
      ...item,
      ...updates,
      updatedAt: Date.now(),
    };

    this.items.set(id, updatedItem);
    return updatedItem;
  }

  /**
   * 刪除項目
   * @param id 項目ID
   * @returns 是否成功刪除
   */
  delete(id: string): boolean {
    return this.items.delete(id);
  }

  /**
   * 列出符合條件的項目
   * @param options 篩選選項
   * @returns 符合條件的項目陣列
   */
  list(options?: { type?: string; tags?: string[]; limit?: number }): MCPItem[] {
    let result = Array.from(this.items.values());

    // 根據類型篩選
    if (options?.type) {
      result = result.filter(item => item.type === options.type);
    }

    // 根據標籤篩選
    if (options?.tags && options.tags.length > 0) {
      result = result.filter(item => 
        item.tags && options.tags?.every(tag => item.tags?.includes(tag))
      );
    }

    // 排序：最新更新的在前面
    result.sort((a, b) => b.updatedAt - a.updatedAt);

    // 限制數量
    if (options?.limit && options.limit > 0) {
      result = result.slice(0, options.limit);
    }

    return result;
  }

  /**
   * 清空記憶空間
   */
  clear(): void {
    this.items.clear();
  }
}

// 導出記憶空間的單例實例
// 使用 getInstance() 方法確保永遠只有一個實例
const memoryStore = MemoryStore.getInstance();

export default memoryStore;
