你是一个资深 Node.js + TypeScript 后端架构师。

现在需要你从 0 到 1 生成一个“生产级”的 TypeScript 后端项目骨架，请严格遵守以下规范，不允许擅自更改架构风格，不允许偷懒省略文件，不允许混乱分层。

========================
一、技术栈要求
=======

* Node.js + Express
* TypeScript
* 必须开启 strict 模式
* 使用 CommonJS（不要用 ESM）
* 使用 Zod 做参数校验
* 使用 dotenv 管理环境变量
* 使用 ESLint + Prettier
* 使用 async/await
* 禁止使用 .then / .catch 链式风格代替 async/await

========================
二、项目目标
======

请生成一套结构清晰、可维护、可扩展、符合 RESTful API 风格的 TypeScript 后端项目模板。

项目必须体现：

* 清晰分层
* 统一返回格式
* 统一错误处理
* 严格类型约束
* RESTful API 设计规范
* 可直接运行的示例用户模块

========================
三、目录结构要求
========

必须生成如下结构：

src/
app.ts
server.ts

config/
env.ts

constants/
error-code.ts

types/
common.ts
express.d.ts

utils/
response.ts

middlewares/
async-handler.ts
error-handler.ts
validate.ts

schemas/
user.schema.ts

models/
user.model.ts

repositories/
user.repository.ts

services/
user.service.ts

controllers/
user.controller.ts

routes/
user.route.ts

要求：

* 每个文件都必须有实际代码
* 不允许只给空壳文件
* 每层职责必须严格分离
* 所有导入路径必须正确
* 最终代码必须可直接运行

========================
四、分层规范（必须严格执行）
==============

1. routes 层：

* 只负责注册路由
* 只负责绑定中间件
* 只负责调用 controller
* 不允许写业务逻辑
* 不允许直接操作数据库

2. controllers 层：

* 只负责接收请求
* 只负责提取 params / query / body
* 只负责调用 service
* 只负责返回统一响应
* 不允许写复杂业务逻辑
* 不允许直接操作数据库

3. services 层：

* 只负责核心业务逻辑
* 负责业务规则校验
* 负责协调多个 repository
* 可以抛出业务错误 AppError

4. repositories 层：

* 只负责数据访问
* 本次可先使用内存数组模拟数据库
* 不允许写业务规则判断

5. schemas 层：

* 只负责请求参数校验
* 使用 zod
* body / params / query 的校验都要清晰定义

========================
五、RESTful API 规范（必须严格执行）
========================

所有路由必须遵循 RESTful API 风格，禁止写成 RPC 风格接口。

正确示例：

* GET /users
* GET /users/:id
* POST /users
* PATCH /users/:id
* DELETE /users/:id

错误示例：

* POST /getUser
* POST /createUser
* POST /deleteUserById
* POST /updateUserStatus

要求：

1. 路径必须使用资源名复数形式，例如 /users
2. 获取列表使用 GET
3. 获取单个资源使用 GET /resources/:id
4. 创建资源使用 POST
5. 局部更新使用 PATCH
6. 删除资源使用 DELETE
7. 不允许在 URL 中写动作词，如 create、update、delete、get
8. 路由命名必须语义化、统一、简洁
9. HTTP 方法语义必须正确
10. 返回状态码必须合理，例如：

* 创建成功：201
* 查询成功：200
* 删除成功：200 或 204
* 参数错误：400
* 资源不存在：404
* 冲突：409
* 服务器错误：500

========================
六、类型规范
======

* 禁止滥用 any
* 所有函数必须写参数类型和返回值类型
* DTO / Entity / Response 必须分离
* 不允许把数据库实体直接原样返回给前端

必须至少定义以下类型：

1. CreateUserDto
2. UpdateUserDto
3. UserEntity
4. UserResponse

要求说明：

* CreateUserDto：创建用户的请求参数
* UpdateUserDto：更新用户的请求参数
* UserEntity：仓储层存储的数据结构
* UserResponse：接口返回给前端的结构

========================
七、参数校验规范
========

使用 zod 完成参数校验。

至少需要：

* createUserBodySchema
* updateUserBodySchema
* userIdParamSchema

要求：

* POST /users 校验 body
* PATCH /users/:id 校验 params + body
* GET /users/:id 校验 params
* DELETE /users/:id 校验 params

validate 中间件必须支持校验：

* req.body
* req.params
* req.query

========================
八、统一响应格式
========

所有成功响应统一为：

{
"code": 0,
"message": "success",
"data": ...
}

所有失败响应统一为：

{
"code": number,
"message": string,
"data": null
}

必须封装：

* success(data, message?)
* fail(code, message)

========================
九、错误处理规范
========

必须实现：

1. AppError 自定义错误类
   字段至少包括：

* message
* statusCode
* code

2. 全局错误处理中间件 errorHandler
   要求：

* 统一处理 AppError
* 统一处理未知错误
* 返回统一失败格式
* 不允许把错误处理散落在 controller 中

3. asyncHandler
   要求：

* 包装所有 async controller
* 避免每个 controller 手写 try/catch

========================
十、环境变量规范
========

* 使用 dotenv
* 所有环境变量统一在 config/env.ts 中解析
* 使用 zod 校验环境变量
* 禁止在业务代码中到处直接写 process.env

至少包含：

* NODE_ENV
* PORT

========================
十一、代码风格规范
=========

命名规范：

* 文件名：kebab-case
* 变量名：camelCase
* 函数名：camelCase
* 类型 / 接口 / 类 / 枚举：PascalCase
* 常量：UPPER_SNAKE_CASE

其他要求：

* 一个文件职责单一
* 不要把过多逻辑塞进同一个文件
* 不要写重复代码
* 所有 import 顺序清晰
* 不允许出现明显无用代码

========================
十二、注释规范（必须）
===========

必须写高质量中文注释：

1. 每个文件顶部写“文件作用说明”
2. 每个函数上方写注释，说明：

* 函数作用
* 参数
* 返回值
* 注意事项

3. 关键逻辑必须解释“为什么这样写”
4. 注释不要写废话，不要解释显而易见的代码

========================
十三、必须实现的示例模块：用户模块
=================

请基于 RESTful API 风格，实现一个完整的 users 模块，至少包含以下接口：

1. GET /users

* 获取用户列表

2. GET /users/:id

* 获取单个用户详情

3. POST /users

* 创建用户

4. PATCH /users/:id

* 更新用户部分字段

5. DELETE /users/:id

* 删除用户

要求：

* 必须有完整 route / controller / service / repository / schema / model
* repository 使用内存数组模拟数据库
* 创建用户时校验邮箱不能重复
* 查询不到用户时返回 404
* 邮箱重复时返回 409
* PATCH 必须是部分更新，不要要求前端传完整对象
* DELETE 删除成功后返回合理响应

========================
十四、响应与状态码要求
===========

请为用户模块正确使用 HTTP 状态码：

* GET /users -> 200
* GET /users/:id -> 200
* POST /users -> 201
* PATCH /users/:id -> 200
* DELETE /users/:id -> 200 或 204
* 参数错误 -> 400
* 用户不存在 -> 404
* 邮箱重复 -> 409
* 未知错误 -> 500

========================
十五、输出要求
=======

请直接输出完整项目代码，必须满足以下要求：

1. 按文件逐个输出

2. 每个文件开头必须标明文件路径，例如：
   // src/services/user.service.ts

3. 不要只输出片段

4. 不要省略任何文件

5. 不要用伪代码

6. 所有代码必须能拼成一个可运行项目

7. 最后补充：

   * 项目启动方式
   * 安装依赖命令
   * 运行命令
   * 接口清单

========================
十六、额外要求
=======

* 不允许生成 RPC 风格接口
* 不允许控制器直接访问仓储层
* 不允许把参数校验写在 controller 里
* 不允许把业务逻辑写在 route 里
* 不允许使用 any 糊弄类型系统
* 不允许省略错误处理中间件
* 不允许省略统一响应工具
* 不允许省略 RESTful API 设计说明

现在开始生成完整项目代码。
