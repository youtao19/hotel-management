# review

## 模块职责

`review` 负责客户好评邀请、评价结果标记、待处理列表、历史评价列表和好评统计接口。

## API 接口

- `GET /api/reviews/pending-invitations`
- `GET /api/reviews/pending-reviews`
- `GET /api/reviews/all`
- `GET /api/reviews/statistics`
- `POST /api/reviews/:orderId/invite`
- `PUT /api/reviews/:orderId/status`
- `GET /api/reviews/:orderId`

## 当前阶段

Phase 3: routes/controller/validator/service/repository 已拆分。旧 `../reviewInvitationModule` 仅保留兼容导出，实际业务流在 `review.service.js`，SQL 和数据库访问在 `review.repository.js`。

## 请求和响应

### `GET /api/reviews/pending-invitations`

响应：

```json
{
  "message": "获取待邀请好评订单成功",
  "orders": []
}
```

### `GET /api/reviews/pending-reviews`

响应：

```json
{
  "message": "获取待更新好评状态订单成功",
  "orders": []
}
```

### `GET /api/reviews/all`

查询参数：

- `startDate`: 可选，`YYYY-MM-DD`
- `endDate`: 可选，`YYYY-MM-DD`
- `status`: 可选，`invited` / `positive` / `negative`

响应：

```json
{
  "message": "获取所有好评记录成功",
  "orders": []
}
```

### `GET /api/reviews/statistics`

查询参数：

- `startDate`: 可选，`YYYY-MM-DD`
- `endDate`: 可选，`YYYY-MM-DD`

响应：

```json
{
  "message": "获取好评统计成功",
  "total_invitations": "0",
  "positive_reviews": "0",
  "negative_reviews": "0",
  "pending_reviews": "0",
  "positive_rate": null
}
```

### `POST /api/reviews/:orderId/invite`

响应：

```json
{
  "message": "已成功邀请客户 张三 参与好评",
  "order": {}
}
```

### `PUT /api/reviews/:orderId/status`

请求：

```json
{
  "positive_review": true
}
```

响应：

```json
{
  "message": "已将客户 张三 的评价设置为好评",
  "order": {}
}
```

### `GET /api/reviews/:orderId`

响应：

```json
{
  "message": "获取好评信息成功",
  "order": [],
  "review": {}
}
```

## 业务流程

- `GET /api/reviews/pending-invitations` -> `reviewService.listPendingInvitations()` -> `reviewRepository.getPendingReviewInvitations()`
- `GET /api/reviews/pending-reviews` -> `reviewService.listPendingReviews()` -> `reviewRepository.getPendingReviewUpdates()`
- `GET /api/reviews/all` -> `reviewService.listAllReviews()` -> `reviewRepository.getAllReviewOrders()`
- `GET /api/reviews/statistics` -> `reviewService.getReviewStatistics()` -> `reviewRepository.getReviewStatistics()`
- `POST /api/reviews/:orderId/invite` -> `reviewService.inviteReview()` -> `orderManageService.getOrder()` -> `reviewRepository.inviteReview()` -> `reviewRepository.getOrderWithReviewInfo()`
- `PUT /api/reviews/:orderId/status` -> `reviewService.updateReviewStatus()` -> `orderManageService.getOrder()` -> `reviewRepository.getReviewByOrderId()` -> `reviewRepository.updateReviewStatus()` -> `reviewRepository.getOrderWithReviewInfo()`
- `GET /api/reviews/:orderId` -> `reviewService.getReviewByOrderId()` -> `orderManageService.getOrder()` -> `reviewRepository.getReviewByOrderId()`

## 依赖说明

- `../order-manage/orderManage.service`
- `../../database/postgreDB/pg`
- `ajv`
- `ajv-formats`

## 注意事项

- API 路径不能改。
- 请求和响应格式不能改。
- 旧 `../reviewInvitationModule` 仅用于兼容旧引用，新代码应直接依赖本模块。
- `positive_review` 必须是布尔值，不能省略，也不能携带额外字段。
- `GET /api/reviews/:orderId` 的 `order` 字段继续沿用 `orderManageService.getOrder()` 的数组响应口径。
- DATE 字段按 `YYYY-MM-DD` 字符串透传，不使用 `toISOString()`。
