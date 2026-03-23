-- =========================
-- 1) OTA订单主表
-- =========================
create table if not exists ota_order (
    id                      bigserial primary key,
    platform                varchar(32) not null,
    douyin_order_id         varchar(64) not null,
    pms_order_id            varchar(64),
    hotel_id                varchar(64) not null,
    room_id                 varchar(64),
    rate_plan_id            varchar(64),
    biz_type                varchar(32),
    check_in_date           date not null,
    check_out_date          date not null,
    number_of_units         integer not null default 1,
    number_of_guests        integer not null default 1,
    raw_payload             jsonb not null,
    sign_verified           boolean not null default false,
    status                  varchar(32) not null default 'pending',
    hotel_confirm_number    varchar(128),
    reject_code             varchar(64),
    reject_reason           text,
    created_at              timestamptz not null default now(),
    updated_at              timestamptz not null default now()
);

comment on table ota_order is 'OTA订单主表，记录外部平台订单与PMS订单之间的对应关系及接单处理状态';

comment on column ota_order.id is '主键';
comment on column ota_order.platform is 'OTA平台标识，如 douyin';
comment on column ota_order.douyin_order_id is 'OTA侧订单号，当前场景主要为抖音订单号';
comment on column ota_order.pms_order_id is 'PMS系统内部订单号';
comment on column ota_order.hotel_id is 'OTA侧酒店ID';
comment on column ota_order.room_id is 'OTA侧物理房型ID';
comment on column ota_order.rate_plan_id is 'OTA侧售卖房型/价计划ID';
comment on column ota_order.biz_type is '业务类型';
comment on column ota_order.check_in_date is '入住日期';
comment on column ota_order.check_out_date is '离店日期';
comment on column ota_order.number_of_units is '预订间数';
comment on column ota_order.number_of_guests is '入住人数';
comment on column ota_order.raw_payload is 'OTA原始请求报文';
comment on column ota_order.sign_verified is '签名校验是否通过';
comment on column ota_order.status is '接单处理状态，如 pending/accepted/rejected/failed';
comment on column ota_order.hotel_confirm_number is '酒店确认号';
comment on column ota_order.reject_code is '拒单编码';
comment on column ota_order.reject_reason is '拒单原因';
comment on column ota_order.created_at is '创建时间';
comment on column ota_order.updated_at is '更新时间';

create unique index if not exists uk_ota_order_platform_order_id
    on ota_order(platform, douyin_order_id);

create index if not exists idx_ota_order_pms_order_id
    on ota_order(pms_order_id);

create index if not exists idx_ota_order_hotel_id
    on ota_order(hotel_id);

create index if not exists idx_ota_order_status
    on ota_order(status);



-- =========================
-- 2) 酒店映射表
-- =========================
create table if not exists ota_hotel_mapping (
    id                  bigserial primary key,
    platform            varchar(32) not null,
    ota_hotel_id        varchar(64) not null,
    pms_hotel_id        varchar(64) not null,
    status              varchar(32) not null default 'active',
    remark              text,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

comment on table ota_hotel_mapping is 'OTA酒店映射表，用于维护OTA酒店ID与PMS酒店ID之间的对应关系';

comment on column ota_hotel_mapping.id is '主键';
comment on column ota_hotel_mapping.platform is 'OTA平台标识，如 douyin';
comment on column ota_hotel_mapping.ota_hotel_id is 'OTA侧酒店ID';
comment on column ota_hotel_mapping.pms_hotel_id is 'PMS侧酒店ID';
comment on column ota_hotel_mapping.status is '映射状态，如 active/inactive';
comment on column ota_hotel_mapping.remark is '备注';
comment on column ota_hotel_mapping.created_at is '创建时间';
comment on column ota_hotel_mapping.updated_at is '更新时间';

create unique index if not exists uk_ota_hotel_mapping_platform_hotel
    on ota_hotel_mapping(platform, ota_hotel_id);

create index if not exists idx_ota_hotel_mapping_pms_hotel_id
    on ota_hotel_mapping(pms_hotel_id);



-- =========================
-- 3) 房型映射表
-- =========================
create table if not exists ota_room_type_mapping (
    id                      bigserial primary key,
    platform                varchar(32) not null,
    ota_hotel_id            varchar(64) not null,
    pms_hotel_id            varchar(64) not null,
    douyin_room_id          varchar(64) not null,
    douyin_rate_plan_id     varchar(64) not null,
    pms_room_type_id        varchar(64) not null,
    pms_rate_plan_id        varchar(64),
    status                  varchar(32) not null default 'active',
    remark                  text,
    created_at              timestamptz not null default now(),
    updated_at              timestamptz not null default now()
);

comment on table ota_room_type_mapping is 'OTA房型映射表，用于维护OTA房型/价计划与PMS房型/价计划之间的对应关系';

comment on column ota_room_type_mapping.id is '主键';
comment on column ota_room_type_mapping.platform is 'OTA平台标识，如 douyin';
comment on column ota_room_type_mapping.ota_hotel_id is 'OTA侧酒店ID';
comment on column ota_room_type_mapping.pms_hotel_id is 'PMS侧酒店ID';
comment on column ota_room_type_mapping.douyin_room_id is 'OTA侧物理房型ID，当前场景主要为抖音 room_id';
comment on column ota_room_type_mapping.douyin_rate_plan_id is 'OTA侧售卖房型/价计划ID，当前场景主要为抖音 rate_plan_id';
comment on column ota_room_type_mapping.pms_room_type_id is 'PMS侧房型ID';
comment on column ota_room_type_mapping.pms_rate_plan_id is 'PMS侧价计划ID';
comment on column ota_room_type_mapping.status is '映射状态，如 active/inactive';
comment on column ota_room_type_mapping.remark is '备注';
comment on column ota_room_type_mapping.created_at is '创建时间';
comment on column ota_room_type_mapping.updated_at is '更新时间';

create unique index if not exists uk_ota_room_mapping_platform_room_rate
    on ota_room_type_mapping(platform, ota_hotel_id, douyin_room_id, douyin_rate_plan_id);

create index if not exists idx_ota_room_mapping_pms_room_type_id
    on ota_room_type_mapping(pms_room_type_id);

create index if not exists idx_ota_room_mapping_pms_rate_plan_id
    on ota_room_type_mapping(pms_rate_plan_id);



-- =========================
-- 4) 回调日志表
-- =========================
create table if not exists ota_callback_log (
    id                  bigserial primary key,
    platform            varchar(32) not null,
    douyin_order_id     varchar(64),
    event_type          varchar(64) not null,
    headers_json        jsonb,
    body_json           jsonb,
    verify_result       varchar(32),
    process_result      varchar(32),
    error_message       text,
    created_at          timestamptz not null default now()
);

comment on table ota_callback_log is 'OTA回调日志表，用于记录回调请求头、请求体、验签结果和处理结果，便于排查问题';

comment on column ota_callback_log.id is '主键';
comment on column ota_callback_log.platform is 'OTA平台标识，如 douyin';
comment on column ota_callback_log.douyin_order_id is 'OTA侧订单号，当前场景主要为抖音订单号';
comment on column ota_callback_log.event_type is '事件类型，如 create_order、confirm_order';
comment on column ota_callback_log.headers_json is '回调请求头JSON';
comment on column ota_callback_log.body_json is '回调请求体JSON';
comment on column ota_callback_log.verify_result is '验签结果，如 success/failed';
comment on column ota_callback_log.process_result is '业务处理结果，如 success/failed';
comment on column ota_callback_log.error_message is '错误信息';
comment on column ota_callback_log.created_at is '创建时间';

create index if not exists idx_ota_callback_log_platform_order_id
    on ota_callback_log(platform, douyin_order_id);

create index if not exists idx_ota_callback_log_event_type
    on ota_callback_log(event_type);

create index if not exists idx_ota_callback_log_created_at
    on ota_callback_log(created_at);