-- 为既有表补充元数据注释，方便数据库客户端、排障和后续维护准确理解字段用途。

COMMENT ON TABLE account IS '系统登录账号表';
COMMENT ON COLUMN account.id IS '账号主键';
COMMENT ON COLUMN account.name IS '账号显示名称';
COMMENT ON COLUMN account.email IS '登录邮箱，唯一';
COMMENT ON COLUMN account.email_verified IS '邮箱是否已验证';
COMMENT ON COLUMN account.created_at IS '账号创建时间';
COMMENT ON COLUMN account.pw IS '密码哈希值，不保存明文密码';

COMMENT ON TABLE bills IS '酒店收支账单流水表';
COMMENT ON COLUMN bills.bill_id IS '账单流水主键';
COMMENT ON COLUMN bills.order_id IS '关联订单号；非客房收入可为空';
COMMENT ON COLUMN bills.room_number IS '关联房间号；非客房收入可为空';
COMMENT ON COLUMN bills.guest_name IS '关联客人姓名';
COMMENT ON COLUMN bills.change_price IS '收支金额，收入为正、支出为负';
COMMENT ON COLUMN bills.change_type IS '收支类型，如房费、收押、退押、补收、退款';
COMMENT ON COLUMN bills.pay_way IS '支付方式';
COMMENT ON COLUMN bills.create_time IS '账单创建时间';
COMMENT ON COLUMN bills.remarks IS '账单备注';
COMMENT ON COLUMN bills.stay_type IS '入住类型';
COMMENT ON COLUMN bills.stay_date IS '对应营业日期';

COMMENT ON TABLE dashboard_memos IS '经营看板备忘事项表';
COMMENT ON COLUMN dashboard_memos.memo_id IS '备忘事项主键';
COMMENT ON COLUMN dashboard_memos.memo_date IS '备忘所属日期';
COMMENT ON COLUMN dashboard_memos.title IS '备忘标题';
COMMENT ON COLUMN dashboard_memos.priority IS '优先级，默认 medium';
COMMENT ON COLUMN dashboard_memos.completed IS '是否已完成';
COMMENT ON COLUMN dashboard_memos.created_at IS '创建时间';
COMMENT ON COLUMN dashboard_memos.updated_at IS '最后更新时间';

COMMENT ON COLUMN douyin_orders.id IS '主键ID';
COMMENT ON COLUMN douyin_orders.created_at IS '记录创建时间';
COMMENT ON COLUMN douyin_orders.updated_at IS '记录更新时间';
COMMENT ON COLUMN douyin_physical_rooms.id IS '主键ID';
COMMENT ON COLUMN douyin_physical_rooms.created_at IS '记录创建时间';
COMMENT ON COLUMN douyin_physical_rooms.updated_at IS '记录更新时间';

COMMENT ON COLUMN douyin_presale_orders.id IS '主键ID';
COMMENT ON COLUMN douyin_presale_orders.account_id IS '抖音商家账户ID';
COMMENT ON COLUMN douyin_presale_orders.hotel_id IS '抖音酒店ID';
COMMENT ON COLUMN douyin_presale_orders.contact_name IS '联系人姓名';
COMMENT ON COLUMN douyin_presale_orders.contact_mobile IS '联系人手机号或加密串';
COMMENT ON COLUMN douyin_presale_orders.guest_name IS '入住人姓名';
COMMENT ON COLUMN douyin_presale_orders.guest_mobile IS '入住人手机号或加密串';
COMMENT ON COLUMN douyin_presale_orders.currency IS '订单币种';
COMMENT ON COLUMN douyin_presale_orders.check_in_date IS '预约入住日期';
COMMENT ON COLUMN douyin_presale_orders.check_out_date IS '预约离店日期';
COMMENT ON COLUMN douyin_presale_orders.early_arrival_time IS '最早到店时间';
COMMENT ON COLUMN douyin_presale_orders.last_arrival_time IS '最晚到店时间';
COMMENT ON COLUMN douyin_presale_orders.raw_payload IS '抖音原始请求体';
COMMENT ON COLUMN douyin_presale_orders.mapped_payload IS '映射后的标准字段';
COMMENT ON COLUMN douyin_presale_orders.created_at IS '记录创建时间';
COMMENT ON COLUMN douyin_presale_orders.updated_at IS '记录更新时间';

COMMENT ON COLUMN douyin_room_type_mapping.id IS '主键ID';
COMMENT ON COLUMN douyin_room_type_mapping.created_at IS '记录创建时间';
COMMENT ON COLUMN douyin_room_type_mapping.updated_at IS '记录更新时间';

COMMENT ON TABLE handover IS '交接班按营业日和支付方式汇总表';
COMMENT ON COLUMN handover.id IS '交接记录主键';
COMMENT ON COLUMN handover.date IS '交接所属营业日期';
COMMENT ON COLUMN handover.handover_person IS '交班人';
COMMENT ON COLUMN handover.takeover_person IS '接班人';
COMMENT ON COLUMN handover.vip_card IS 'VIP 卡数量';
COMMENT ON COLUMN handover.payment_type IS '支付方式：1现金、2微信、3微邮付、4其他';
COMMENT ON COLUMN handover.reserve_cash IS '备用金金额';
COMMENT ON COLUMN handover.room_income IS '客房收入金额';
COMMENT ON COLUMN handover.rest_income IS '休息房收入金额';
COMMENT ON COLUMN handover.rent_income IS '租车收入金额';
COMMENT ON COLUMN handover.total_income IS '本次交接收入合计';
COMMENT ON COLUMN handover.room_refund IS '客房退款金额';
COMMENT ON COLUMN handover.rest_refund IS '休息房退款金额';
COMMENT ON COLUMN handover.retained IS '留存款金额';
COMMENT ON COLUMN handover.handover IS '实际交接款金额';
COMMENT ON COLUMN handover.task_list IS '交接待办事项 JSON 数组';
COMMENT ON COLUMN handover.remarks IS '交接备注';

COMMENT ON TABLE handover_daily_settings IS '交接班营业日现金设置表';
COMMENT ON COLUMN handover_daily_settings.business_date IS '营业日期';
COMMENT ON COLUMN handover_daily_settings.cash_reserve IS '当日备用金金额';
COMMENT ON COLUMN handover_daily_settings.cash_retained IS '当日现金留存金额';
COMMENT ON COLUMN handover_daily_settings.set_by IS '设置人';
COMMENT ON COLUMN handover_daily_settings.created_at IS '创建时间';
COMMENT ON COLUMN handover_daily_settings.updated_at IS '最后更新时间';

COMMENT ON TABLE handover_source_snapshot IS '交接班原始账单快照表';
COMMENT ON COLUMN handover_source_snapshot.id IS '快照记录主键';
COMMENT ON COLUMN handover_source_snapshot.business_date IS '快照所属营业日期';
COMMENT ON COLUMN handover_source_snapshot.source_item IS '收入或退款来源项目';
COMMENT ON COLUMN handover_source_snapshot.payment_method IS '支付方式';
COMMENT ON COLUMN handover_source_snapshot.bill_id IS '来源账单主键';
COMMENT ON COLUMN handover_source_snapshot.order_id IS '关联订单号';
COMMENT ON COLUMN handover_source_snapshot.room_number IS '关联房间号';
COMMENT ON COLUMN handover_source_snapshot.guest_name IS '关联客人姓名';
COMMENT ON COLUMN handover_source_snapshot.change_type IS '来源账单收支类型';
COMMENT ON COLUMN handover_source_snapshot.source_amount IS '来源金额';
COMMENT ON COLUMN handover_source_snapshot.bill_create_time IS '来源账单创建时间';
COMMENT ON COLUMN handover_source_snapshot.remarks IS '来源账单备注';
COMMENT ON COLUMN handover_source_snapshot.created_at IS '快照创建时间';

COMMENT ON TABLE order_changes IS '订单变更审计记录表';
COMMENT ON COLUMN order_changes.change_id IS '变更记录主键';
COMMENT ON COLUMN order_changes.order_id IS '关联订单号';
COMMENT ON COLUMN order_changes.changed_at IS '变更发生时间';
COMMENT ON COLUMN order_changes.changed_by IS '变更操作人';
COMMENT ON COLUMN order_changes.changes IS '变更前后内容 JSON 数据';
COMMENT ON COLUMN order_changes.reason IS '变更原因';

COMMENT ON TABLE orders IS '酒店订单按入住日拆分明细表';
COMMENT ON COLUMN orders.id IS '订单明细主键';
COMMENT ON COLUMN orders.order_id IS '业务订单号，同一订单可按入住日多行保存';
COMMENT ON COLUMN orders.id_source IS '来源系统订单号';
COMMENT ON COLUMN orders.order_source IS '订单来源渠道';
COMMENT ON COLUMN orders.guest_name IS '客人姓名';
COMMENT ON COLUMN orders.phone IS '客人联系电话';
COMMENT ON COLUMN orders.room_type IS '入住酒店房型编码';
COMMENT ON COLUMN orders.room_number IS '入住酒店房间号';
COMMENT ON COLUMN orders.check_in_date IS '订单整体入住日期';
COMMENT ON COLUMN orders.check_out_date IS '订单整体离店日期';
COMMENT ON COLUMN orders.stay_date IS '本行对应实际入住日期';
COMMENT ON COLUMN orders.status IS '订单状态';
COMMENT ON COLUMN orders.payment_method IS '支付方式';
COMMENT ON COLUMN orders.total_price IS '本行单日房费';
COMMENT ON COLUMN orders.deposit IS '押金金额，通常仅首日记录';
COMMENT ON COLUMN orders.is_prepaid IS '下单时是否已收房费';
COMMENT ON COLUMN orders.prepaid_amount IS '预收房费金额';
COMMENT ON COLUMN orders.create_time IS '订单创建时间';
COMMENT ON COLUMN orders.stay_type IS '住宿类型';
COMMENT ON COLUMN orders.remarks IS '订单备注';

COMMENT ON COLUMN ota_channel_mappings.id IS '主键ID';
COMMENT ON COLUMN ota_channel_mappings.local_target_id IS '本地资源主键';
COMMENT ON COLUMN ota_channel_mappings.channel_code IS 'OTA 渠道编码';
COMMENT ON COLUMN ota_channel_mappings.channel_item_id IS '渠道侧资源标识';
COMMENT ON COLUMN ota_channel_mappings.sync_status IS '同步状态：1成功、0待同步、-1失败或下架';
COMMENT ON COLUMN ota_channel_mappings.created_at IS '记录创建时间';
COMMENT ON COLUMN ota_channel_mappings.updated_at IS '记录更新时间';

COMMENT ON COLUMN rate_plans.id IS '套餐主键';
COMMENT ON COLUMN rate_plans.name IS '售卖套餐名称';
COMMENT ON COLUMN rate_plans.base_price IS '套餐基础售价';
COMMENT ON COLUMN rate_plans.status IS '套餐状态：1启用、0停用';
COMMENT ON COLUMN rate_plans.currency IS '价格币种，使用三位 ISO 代码';
COMMENT ON COLUMN rate_plans.hourly_earliest_check_in IS '钟点房最早入住时间';
COMMENT ON COLUMN rate_plans.hourly_latest_check_out IS '钟点房最晚离店时间';
COMMENT ON COLUMN rate_plans.hourly_usage_duration IS '钟点房可使用时长（小时）';
COMMENT ON COLUMN rate_plans.midnight_latest_booking_time IS '凌晨房最晚可预订时点（小时）';
COMMENT ON COLUMN rate_plans.midnight_enabled IS '是否启用凌晨房规则';
COMMENT ON COLUMN rate_plans.created_at IS '记录创建时间';
COMMENT ON COLUMN rate_plans.updated_at IS '记录更新时间';

COMMENT ON TABLE review_invitations IS '订单评价邀请记录表';
COMMENT ON COLUMN review_invitations.id IS '邀请记录主键';
COMMENT ON COLUMN review_invitations.order_id IS '关联订单号';
COMMENT ON COLUMN review_invitations.invited IS '是否已发送评价邀请';
COMMENT ON COLUMN review_invitations.positive_review IS '客人是否给出好评；未评价时为空';
COMMENT ON COLUMN review_invitations.invite_time IS '发送评价邀请时间';
COMMENT ON COLUMN review_invitations.update_time IS '最后更新时间';

COMMENT ON TABLE room_types IS '酒店房型定义表';
COMMENT ON COLUMN room_types.type_code IS '房型编码';
COMMENT ON COLUMN room_types.type_name IS '房型名称';
COMMENT ON COLUMN room_types.base_price IS '房型基础售价';
COMMENT ON COLUMN room_types.description IS '房型说明';
COMMENT ON COLUMN room_types.is_closed IS '房型是否停用';

COMMENT ON TABLE rooms IS '酒店物理房间表';
COMMENT ON COLUMN rooms.room_id IS '房间主键';
COMMENT ON COLUMN rooms.room_number IS '房间号';
COMMENT ON COLUMN rooms.type_code IS '所属房型编码';
COMMENT ON COLUMN rooms.status IS '房间当前状态';
COMMENT ON COLUMN rooms.price IS '房间当前售价';
COMMENT ON COLUMN rooms.is_closed IS '房间是否停用';

COMMENT ON TABLE schema_migrations IS '数据库迁移执行记录表';
COMMENT ON COLUMN schema_migrations.name IS '迁移文件名';
COMMENT ON COLUMN schema_migrations.checksum IS '迁移文件内容 SHA-256 校验值';
COMMENT ON COLUMN schema_migrations.applied_at IS '迁移执行完成时间';

COMMENT ON COLUMN system_notifications.id IS '主键ID';
COMMENT ON COLUMN system_notifications.source IS '通知来源系统或渠道';
COMMENT ON COLUMN system_notifications.event_type IS '外部事件类型';
COMMENT ON COLUMN system_notifications.title IS '通知标题';
COMMENT ON COLUMN system_notifications.content IS '通知正文';
COMMENT ON COLUMN system_notifications.level IS '通知等级，默认 info';
COMMENT ON COLUMN system_notifications.is_read IS '管理员是否已读';
COMMENT ON COLUMN system_notifications.raw_payload IS '外部事件原始数据';
COMMENT ON COLUMN system_notifications.created_at IS '通知创建时间';
