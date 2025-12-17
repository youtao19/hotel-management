# PostgreSQL 时间与时区规范修复进度

## 背景
审查建表文件，确保所有时间字段符合以下规范：
- 时间点字段（表示某一时刻）：使用 `TIMESTAMPTZ`（TIMESTAMP WITH TIME ZONE）
- 业务日期字段（只表示"哪一天"）：使用 `DATE`，不设置 `DEFAULT now()`

## 发现的问题

| 表 | 字段 | 当前类型 | 问题 | 应改为 |
|---|---|---|---|---|
| orders | create_time | TIMESTAMP | 缺少时区 | TIMESTAMPTZ NOT NULL DEFAULT now() |
| bills | create_time | TIMESTAMP | 缺少时区 | TIMESTAMPTZ NOT NULL DEFAULT now() |
| review_invitations | invite_time | TIMESTAMP | 缺少时区 | TIMESTAMPTZ DEFAULT NULL |
| review_invitations | update_time | TIMESTAMP | 缺少时区 | TIMESTAMPTZ DEFAULT NULL |

## 符合规范的表（无需修改）

| 表 | 字段 | 类型 | 状态 |
|---|---|---|---|
| dashboard_memos | created_at | TIMESTAMPTZ | ✅ 正确 |
| dashboard_memos | updated_at | TIMESTAMPTZ | ✅ 正确 |
| dashboard_memos | memo_date | DATE | ✅ 正确 |
| order_changes | changed_at | TIMESTAMPTZ | ✅ 正确 |
| account | created_at | TIMESTAMPTZ | ✅ 正确 |
| handover | date | DATE | ✅ 正确 |
| orders | check_in_date | DATE | ✅ 正确 |
| orders | check_out_date | DATE | ✅ 正确 |
| orders | stay_date | DATE | ✅ 正确 |
| bills | stay_date | DATE | ✅ 正确 |

## 修改流程

- [x] 1. 创建 Progress.md，列出修改计划（本步骤）
- [x] 2. 等待用户确认修改流程
- [x] 3. 修改建表文件（tables/*.js）
- [x] 4. 编写迁移 SQL（ALTER TABLE）
- [x] 5. 编写测试样例
- [x] 6. 执行测试确保通过 ✅ 5/5 passed
- [ ] 7. 提交代码（git commit）

## 详细修改计划

### 3.1 修改 `backend/database/postgreDB/tables/order.js`
```sql
-- 当前
create_time TIMESTAMP NOT NULL

-- 修改为
create_time TIMESTAMPTZ NOT NULL DEFAULT now()
```

### 3.2 修改 `backend/database/postgreDB/tables/bill.js`
```sql
-- 当前
create_time TIMESTAMP NOT NULL

-- 修改为
create_time TIMESTAMPTZ NOT NULL DEFAULT now()
```

### 3.3 修改 `backend/database/postgreDB/tables/review_invitation.js`
```sql
-- 当前
invite_time TIMESTAMP DEFAULT NULL
update_time TIMESTAMP DEFAULT NULL

-- 修改为
invite_time TIMESTAMPTZ DEFAULT NULL
update_time TIMESTAMPTZ DEFAULT NULL
```

### 4. 迁移 SQL（用于已存在的数据库）
```sql
-- orders 表
ALTER TABLE orders 
  ALTER COLUMN create_time TYPE TIMESTAMPTZ USING create_time AT TIME ZONE 'Asia/Shanghai',
  ALTER COLUMN create_time SET DEFAULT now();

-- bills 表
ALTER TABLE bills 
  ALTER COLUMN create_time TYPE TIMESTAMPTZ USING create_time AT TIME ZONE 'Asia/Shanghai',
  ALTER COLUMN create_time SET DEFAULT now();

-- review_invitations 表
ALTER TABLE review_invitations 
  ALTER COLUMN invite_time TYPE TIMESTAMPTZ USING invite_time AT TIME ZONE 'Asia/Shanghai',
  ALTER COLUMN update_time TYPE TIMESTAMPTZ USING update_time AT TIME ZONE 'Asia/Shanghai';
```

---

**请确认以上修改流程，确认后我将执行修改。**
