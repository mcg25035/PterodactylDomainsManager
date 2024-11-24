# PterodactylDomainsManager

## API 概述

| HTTP 方法 | 路徑                                | 說明                                   |狀態|
|-----------|-------------------------------------|----------------------------------------|-------|
| GET       | `/api/domains`                      | 獲取所有三級網域                       |可用|
| GET       | `/api/domains/:id`                  | 根據網域 ID 獲取特定三級網域           |未測試|
| POST      | `/api/domains`                      | 創建新的三級網域                       |可用|
| PUT       | `/api/domains/:id`                  | 更新特定的三級網域                     |未測試|
| DELETE    | `/api/domains/:id`                  | 刪除特定的三級網域                     |可用|
| GET       | `/api/servers/:serverId/domains`    | 根據伺服器 UUID 獲取相關的三級網域     |可用|

以下將逐一詳細說明每個端點的參數和功能。

---

### 1. 獲取所有三級網域

**HTTP 方法**: `GET`

**路徑**: `/api/domains`

**說明**: 獲取系統中所有已管理的三級網域。

**請求參數**: 無

**範例請求**:
```http
GET /api/domains HTTP/1.1
Host: localhost:3000
```

**範例回應**:
```json
[
  {
    "id": "generated-uuid",
    "serverId": "123e4567-e89b-12d3-a456-426614174000",
    "domain": "sub.example.com",
    "targetIp": "192.168.1.100",
    "targetPort": 8080,
    "additionalInfo": "Any other data"
  },
  {
    "id": "another-uuid",
    "serverId": "223e4567-e89b-12d3-a456-426614174001",
    "domain": "another.example.com",
    "targetIp": "192.168.1.101",
    "targetPort": 9090,
    "additionalInfo": "Additional info"
  }
]
```

---

### 2. 根據伺服器 UUID 獲取相關的三級網域

**HTTP 方法**: `GET`

**路徑**: `/api/servers/:serverId/domains`

**說明**: 根據特定伺服器的 UUID 獲取該伺服器所擁有的所有三級網域。

**路徑參數**:
- `serverId` (UUID): 目標伺服器的唯一識別碼。

**範例請求**:
```http
GET /api/servers/123e4567-e89b-12d3-a456-426614174000/domains HTTP/1.1
Host: localhost:3000
```

**範例回應**:
```json
[
  {
    "id": "generated-uuid",
    "serverId": "123e4567-e89b-12d3-a456-426614174000",
    "domain": "sub.example.com",
    "targetIp": "192.168.1.100",
    "targetPort": 8080,
    "additionalInfo": "Any other data"
  }
]
```

**錯誤回應**:
- 若 `serverId` 格式不正確：
    ```json
    {
      "errors": [
        {
          "msg": "Invalid serverId format",
          "param": "serverId",
          "location": "params"
        }
      ]
    }
    ```

---

### 3. 創建新的三級網域

**HTTP 方法**: `POST`

**路徑**: `/api/domains`

**說明**: 創建一個新的三級網域，並將其與特定伺服器相關聯。創建時需指定指向的目標 IP 和端口。

**請求參數**:

**請求主體（JSON）**:
- `serverId` (UUID, **必填**): 目標伺服器的唯一識別碼。
- `thirdLevelDomain` (String, **必填**): 要創建的三級網域名稱（不含第二級網域）。
- `targetIp` (String, **必填**): 指向目標伺服器的 IP 地址。
- `targetPort` (Integer, **必填**): 指向目標伺服器的端口號（1-65535）。
- `additionalInfo` (Object, 選填): 其他相關資料。

**範例請求**:
```http
POST /api/domains HTTP/1.1
Host: localhost:3000
Content-Type: application/json

{
  "serverId": "123e4567-e89b-12d3-a456-426614174000",
  "thirdLevelDomain": "sub",
  "targetIp": "192.168.1.100",
  "targetPort": 8080,
  "additionalInfo": "Any other data"
}
```

**範例回應**:
```json
{
  "id": "generated-uuid",
  "serverId": "123e4567-e89b-12d3-a456-426614174000",
  "domain": "sub.example.com",
  "targetIp": "192.168.1.100",
  "targetPort": 8080,
  "additionalInfo": "Any other data"
}
```

**錯誤回應**:
- 若缺少必填欄位或格式不正確：
    ```json
    {
      "errors": [
        {
          "msg": "Invalid serverId format",
          "param": "serverId",
          "location": "body"
        },
        {
          "msg": "thirdLevelDomain is required",
          "param": "thirdLevelDomain",
          "location": "body"
        },
        {
          "msg": "Invalid target IP address",
          "param": "targetIp",
          "location": "body"
        },
        {
          "msg": "Invalid target port",
          "param": "targetPort",
          "location": "body"
        }
      ]
    }
    ```

---

### 4. 獲取特定三級網域

**HTTP 方法**: `GET`

**路徑**: `/api/domains/:id`

**說明**: 根據特定網域的 ID 獲取該三級網域的詳細資訊。

**路徑參數**:
- `id` (UUID): 目標網域的唯一識別碼。

**範例請求**:
```http
GET /api/domains/generated-uuid HTTP/1.1
Host: localhost:3000
```

**範例回應**:
```json
{
  "id": "generated-uuid",
  "serverId": "123e4567-e89b-12d3-a456-426614174000",
  "domain": "sub.example.com",
  "targetIp": "192.168.1.100",
  "targetPort": 8080,
  "additionalInfo": "Any other data"
}
```

**錯誤回應**:
- 若 `id` 格式不正確：
    ```json
    {
      "errors": [
        {
          "msg": "Invalid domain id format",
          "param": "id",
          "location": "params"
        }
      ]
    }
    ```
- 若找不到該網域：
    ```json
    {
      "message": "Domain not found"
    }
    ```

---

### 5. 更新特定的三級網域

**HTTP 方法**: `PUT`

**路徑**: `/api/domains/:id`

**說明**: 更新特定的三級網域資訊，包括 `thirdLevelDomain`、`targetIp` 和 `targetPort`。可以選擇性更新這些欄位。

**路徑參數**:
- `id` (UUID): 目標網域的唯一識別碼。

**請求參數**:

**請求主體（JSON）**:
- `thirdLevelDomain` (String, 選填): 更新的三級網域名稱（不含第二級網域）。
- `targetIp` (String, 選填): 更新的目標 IP 地址。
- `targetPort` (Integer, 選填): 更新的目標端口號（1-65535）。
- `additionalInfo` (Object, 選填): 其他相關資料。

**範例請求**:
```http
PUT /api/domains/generated-uuid HTTP/1.1
Host: localhost:3000
Content-Type: application/json

{
  "thirdLevelDomain": "newsub",
  "targetIp": "192.168.1.101",
  "targetPort": 9090,
  "additionalInfo": "Updated data"
}
```

**範例回應**:
```json
{
  "id": "generated-uuid",
  "serverId": "123e4567-e89b-12d3-a456-426614174000",
  "domain": "newsub.example.com",
  "targetIp": "192.168.1.101",
  "targetPort": 9090,
  "additionalInfo": "Updated data"
}
```

**錯誤回應**:
- 若 `id` 格式不正確：
    ```json
    {
      "errors": [
        {
          "msg": "Invalid domain id format",
          "param": "id",
          "location": "params"
        }
      ]
    }
    ```
- 若請求主體中包含無效的欄位格式：
    ```json
    {
      "errors": [
        {
          "msg": "thirdLevelDomain must be a non-empty string",
          "param": "thirdLevelDomain",
          "location": "body"
        },
        {
          "msg": "Invalid target IP address",
          "param": "targetIp",
          "location": "body"
        },
        {
          "msg": "Invalid target port",
          "param": "targetPort",
          "location": "body"
        }
      ]
    }
    ```
- 若找不到該網域：
    ```json
    {
      "message": "Domain not found"
    }
    ```

---

### 6. 刪除特定的三級網域

**HTTP 方法**: `DELETE`

**路徑**: `/api/domains/:id`

**說明**: 刪除特定的三級網域。

**路徑參數**:
- `id` (UUID): 目標網域的唯一識別碼。

**範例請求**:
```http
DELETE /api/domains/generated-uuid HTTP/1.1
Host: localhost:3000
```

**範例回應**:
```
HTTP/1.1 204 No Content
```

**錯誤回應**:
- 若 `id` 格式不正確：
    ```json
    {
      "errors": [
        {
          "msg": "Invalid domain id format",
          "param": "id",
          "location": "params"
        }
      ]
    }
    ```
- 若找不到該網域：
    ```json
    {
      "message": "Domain not found"
    }
    ```

---

## 總結

以下是 **PterodactylDomainsManager** 的所有 HTTP API 端點及其參數說明：

### 1. 獲取所有三級網域
- **方法**: `GET`
- **路徑**: `/api/domains`
- **參數**: 無
- **功能**: 獲取所有已管理的三級網域。

### 2. 根據伺服器 UUID 獲取相關的三級網域
- **方法**: `GET`
- **路徑**: `/api/servers/:serverId/domains`
- **路徑參數**:
  - `serverId` (UUID, **必填**): 目標伺服器的唯一識別碼。
- **功能**: 獲取特定伺服器所擁有的所有三級網域。

### 3. 創建新的三級網域
- **方法**: `POST`
- **路徑**: `/api/domains`
- **請求主體**:
  - `serverId` (UUID, **必填**): 目標伺服器的唯一識別碼。
  - `thirdLevelDomain` (String, **必填**): 要創建的三級網域名稱（不含第二級網域）。
  - `targetIp` (String, **必填**): 指向目標伺服器的 IP 地址。
  - `targetPort` (Integer, **必填**): 指向目標伺服器的端口號（1-65535）。
  - `additionalInfo` (Object, 選填): 其他相關資料。
- **功能**: 創建一個新的三級網域，並將其與特定伺服器相關聯。

### 4. 獲取特定三級網域
- **方法**: `GET`
- **路徑**: `/api/domains/:id`
- **路徑參數**:
  - `id` (UUID, **必填**): 目標網域的唯一識別碼。
- **功能**: 獲取特定 ID 的三級網域詳細資訊。

### 5. 更新特定的三級網域
- **方法**: `PUT`
- **路徑**: `/api/domains/:id`
- **路徑參數**:
  - `id` (UUID, **必填**): 目標網域的唯一識別碼。
- **請求主體**:
  - `thirdLevelDomain` (String, 選填): 更新的三級網域名稱（不含第二級網域）。
  - `targetIp` (String, 選填): 更新的目標 IP 地址。
  - `targetPort` (Integer, 選填): 更新的目標端口號（1-65535）。
  - `additionalInfo` (Object, 選填): 其他相關資料。
- **功能**: 更新特定的三級網域資訊。

### 6. 刪除特定的三級網域
- **方法**: `DELETE`
- **路徑**: `/api/domains/:id`
- **路徑參數**:
  - `id` (UUID, **必填**): 目標網域的唯一識別碼。
- **功能**: 刪除特定的三級網域。

---

## 補充說明

- **UUID 格式驗證**: 所有涉及 UUID 的路徑參數（如 `serverId` 和 `id`）都需要符合 UUID 格式。API 將返回格式錯誤的訊息以提示用戶。
  
- **IP 地址與端口驗證**: `targetIp` 需符合有效的 IP 地址格式，`targetPort` 需為 1 至 65535 之間的整數。

- **資料一致性**: 創建或更新網域時，`thirdLevelDomain` 將與固定的 `SECOND_LEVEL_DOMAIN` 組合成完整的域名，如 `sub.example.com`。

- **錯誤處理**: API 將根據不同的情況返回適當的錯誤訊息，包括格式錯誤、缺少必填欄位或資源未找到等情況。

- **內部使用**: 由於這些 API 僅供本機內部使用，安全性措施（如速率限制和 API 金鑰）已被移除。但建議在未來擴展至外部使用時，重新考慮加入這些安全措施。

---

## 完整的 API 端點列表

以下是所有 API 端點的完整列表，便於參考和使用：

1. **獲取所有三級網域**
    - **方法**: `GET`
    - **路徑**: `/api/domains`
    - **參數**: 無

2. **根據伺服器 UUID 獲取相關的三級網域**
    - **方法**: `GET`
    - **路徑**: `/api/servers/:serverId/domains`
    - **路徑參數**:
        - `serverId` (UUID, **必填**)

3. **創建新的三級網域**
    - **方法**: `POST`
    - **路徑**: `/api/domains`
    - **請求主體**:
        - `serverId` (UUID, **必填**)
        - `thirdLevelDomain` (String, **必填**)
        - `targetIp` (String, **必填**)
        - `targetPort` (Integer, **必填**)
        - `additionalInfo` (Object, 選填)

4. **獲取特定三級網域**
    - **方法**: `GET`
    - **路徑**: `/api/domains/:id`
    - **路徑參數**:
        - `id` (UUID, **必填**)

5. **更新特定的三級網域**
    - **方法**: `PUT`
    - **路徑**: `/api/domains/:id`
    - **路徑參數**:
        - `id` (UUID, **必填**)
    - **請求主體**:
        - `thirdLevelDomain` (String, 選填)
        - `targetIp` (String, 選填)
        - `targetPort` (Integer, 選填)
        - `additionalInfo` (Object, 選填)

6. **刪除特定的三級網域**
    - **方法**: `DELETE`
    - **路徑**: `/api/domains/:id`
    - **路徑參數**:
        - `id` (UUID, **必填**)

