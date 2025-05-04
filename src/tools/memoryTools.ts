import { z } from "zod";
import { RegisterToolType } from "./type";
import memoryStore from "../store";
import { 
  createTextResponse, 
  createErrorResponse, 
  formatJson 
} from "../utils/responseUtils";

export const storeData: RegisterToolType = (tool) => {
  const schema = {
    id: z.string().optional().describe("要存儲的資訊 ID"),
    type: z.string().describe("資訊類型"),
    content: z.any().describe("資訊內容"),
    tags: z.array(z.string()).optional().describe("資訊標籤"),
  };

  tool("store_data", "存儲資訊", schema, async (args) => {
    try {
      const { id, type, content, tags } = z.object(schema).parse(args);
      // 如果沒有提供ID，則生成一個
      const itemId =
        id ||
        `${type}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      const item = memoryStore.add({
        id: itemId,
        type,
        content,
        tags,
      });

      return createTextResponse(formatJson(item));
    } catch (error) {
      return createErrorResponse(error);
    }
  });
};

export const retrieveData: RegisterToolType = (tool) => {
  const schema = {
    id: z.string().optional().describe("要獲取的資訊 ID"),
    type: z.string().optional().describe("資訊類型"),
    tags: z.array(z.string()).optional().describe("資訊標籤"),
    limit: z.number().optional().describe("限制數量"),
  };

  tool("retrieve_data", "根據條件獲取資訊", schema, async (args) => {
    try {
      const { id, type, tags, limit } = z.object(schema).parse(args);
      if (id) {
        // 如果提供了ID，則獲取特定項目
        const item = memoryStore.get(id);
        if (!item) {
          return createErrorResponse(`未找到ID為 ${id} 的項目`);
        }
        return createTextResponse(formatJson(item));
      } else {
        // 否則獲取符合條件的項目列表
        const items = memoryStore.list({ type, tags, limit });
        return createTextResponse(formatJson(items));
      }
    } catch (error) {
      return createErrorResponse(error);
    }
  });
};

export const updateDataById: RegisterToolType = (tool) => {
  const schema = {
    id: z.string().describe("要更新的資訊 ID"),
    type: z.string().optional().describe("資訊類型"),
    content: z.any().optional().describe("資訊內容"),
    tags: z.array(z.string()).optional().describe("資訊標籤"),
  };

  tool("update_data_by_id", "根據 ID 更新資訊", schema, async (args, extra) => {
    try {
      const { id, ...rest } = z.object(schema).parse(args);
      const item = memoryStore.update(id, rest);

      if (!item) {
        return createErrorResponse(`未找到ID為 ${id} 的項目`);
      }

      return createTextResponse(formatJson(item));
    } catch (error) {
      return createErrorResponse(error);
    }
  });
};

export const deleteDataById: RegisterToolType = (tool) => {
  const schema = {
    id: z.string().describe("要刪除的資訊 ID"),
  };

  tool("delete_data_by_id", "根據 ID 刪除資訊", schema, async (args, extra) => {
    try {
      const { id } = z.object(schema).parse(args);
      const success = memoryStore.delete(id);

      if (!success) {
        return createErrorResponse(`未找到ID為 ${id} 的項目`);
      }

      return createTextResponse(`成功刪除ID為 ${id} 的項目`);
    } catch (error) {
      return createErrorResponse(error);
    }
  });
};

export const clearMemory: RegisterToolType = (tool) => {
  tool("clear_memory", "清空記憶空間", async () => {
    try {
      memoryStore.clear();
      return createTextResponse("記憶空間已清空");
    } catch (error) {
      return createErrorResponse(error);
    }
  });
};
