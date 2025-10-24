-- 酒店管理系统数据导出
-- 导出时间: 2025-10-24T10:23:57.015Z
-- 注意：导入前请确保目标数据库已创建相应的表结构

-- account 表数据 (7 条记录)
INSERT INTO "account" ("id", "name", "email", "email_verified", "created_at", "pw") VALUES (1, 'youtao', 'wuyoutao19@qq.com', TRUE, '2025-10-11T09:40:26.186Z', '$2b$10$fAMTTu3PY4Bhpi.r5DlNaep9VjFv5iWUqLzI9edMSUID2D58zJELG');
INSERT INTO "account" ("id", "name", "email", "email_verified", "created_at", "pw") VALUES (2, 'youtao', 'peach19@foxmail.com', TRUE, '2025-10-11T09:43:32.597Z', '$2b$10$f/xuE1nC3SrAnXgeTwI.Q.OOowIMNW.DveYpBLsbfaZdug2LhDZ/S');
INSERT INTO "account" ("id", "name", "email", "email_verified", "created_at", "pw") VALUES (3, 'Test User', 'test@test.com', FALSE, '2025-10-11T09:48:15.187Z', '$2b$10$NL0XPvHrCUApMCYoz7t99Ojjd9EtyalV9PuSWReWDkDWZbIBs7hE6');
INSERT INTO "account" ("id", "name", "email", "email_verified", "created_at", "pw") VALUES (4, 'peach19', '3225186379@qq.com', FALSE, '2025-10-11T09:49:17.338Z', '$2b$10$fs1udFV2wHsU7.mBOS0bPOX89GwFpJqHVohQmMYYOwm8QS/QY.Dou');
INSERT INTO "account" ("id", "name", "email", "email_verified", "created_at", "pw") VALUES (5, 'youtao', 'wuyoutao19@gmail.com', FALSE, '2025-10-11T09:56:58.015Z', '$2b$10$qT1qA5XhQVY/I0W7XD6YOOo890gyKZd.tdNg8Z7SujLME0pE7okSu');
INSERT INTO "account" ("id", "name", "email", "email_verified", "created_at", "pw") VALUES (6, 'youtao', 'wuyoutao19@outlook.com', FALSE, '2025-10-11T09:59:41.317Z', '$2b$10$ZgYaNbVckGzmp6Yizak/h.cHfo/N1rWchWqMn5Qzif3VygVUhqyBG');
INSERT INTO "account" ("id", "name", "email", "email_verified", "created_at", "pw") VALUES (7, 'youtao', 'peach19@qq.com', FALSE, '2025-10-11T12:25:30.505Z', '$2b$10$R01kyL5ppAlz3cqxqfbw0eGnD0lHM9/pxNnQTWPOVYTe4K47qeLS.');

-- bills 表数据 (9 条记录)
INSERT INTO "bills" ("bill_id", "order_id", "room_number", "guest_name", "change_price", "change_type", "pay_way", "create_time", "remarks", "stay_type", "stay_date") VALUES (1, 'O202510110372', '211', '吴友桃', '268.00', '房费', '微邮付', '2025-10-11T04:55:36.990Z', '办理入住创建', '客房', '2025-10-10T16:00:00.000Z');
INSERT INTO "bills" ("bill_id", "order_id", "room_number", "guest_name", "change_price", "change_type", "pay_way", "create_time", "remarks", "stay_type", "stay_date") VALUES (2, 'O202510110372', '211', '吴友桃', '100.00', '收押', '微邮付', '2025-10-11T04:55:36.994Z', '办理入住收押金', '客房', '2025-10-10T16:00:00.000Z');
INSERT INTO "bills" ("bill_id", "order_id", "room_number", "guest_name", "change_price", "change_type", "pay_way", "create_time", "remarks", "stay_type", "stay_date") VALUES (3, 'O202510110372', '211', '吴友桃', '-100.00', '退押', '微邮付', '2025-10-11T04:55:46.835Z', '', '客房', '2025-10-10T16:00:00.000Z');
INSERT INTO "bills" ("bill_id", "order_id", "room_number", "guest_name", "change_price", "change_type", "pay_way", "create_time", "remarks", "stay_type", "stay_date") VALUES (4, 'O202EXT101120558459', '211', '吴友桃[续2367]', '268.00', '房费', '现金', '2025-10-11T04:55:55.582Z', '办理入住创建', '客房', '2025-10-10T16:00:00.000Z');
INSERT INTO "bills" ("bill_id", "order_id", "room_number", "guest_name", "change_price", "change_type", "pay_way", "create_time", "remarks", "stay_type", "stay_date") VALUES (5, 'O202510121253', '205', 'wuuy', '268.00', '房费', '微邮付', '2025-10-11T22:17:52.454Z', '办理入住创建', '客房', '2025-10-11T16:00:00.000Z');
INSERT INTO "bills" ("bill_id", "order_id", "room_number", "guest_name", "change_price", "change_type", "pay_way", "create_time", "remarks", "stay_type", "stay_date") VALUES (6, 'O202510121253', '205', 'wuuy', '100.00', '收押', '微邮付', '2025-10-11T22:17:52.458Z', '办理入住收押金', '客房', '2025-10-11T16:00:00.000Z');
INSERT INTO "bills" ("bill_id", "order_id", "room_number", "guest_name", "change_price", "change_type", "pay_way", "create_time", "remarks", "stay_type", "stay_date") VALUES (7, 'O202510192045', '101', '李白', '288.00', '房费', '微邮付', '2025-10-19T04:12:40.866Z', '第 1 天房费', '客房', '2025-10-18T16:00:00.000Z');
INSERT INTO "bills" ("bill_id", "order_id", "room_number", "guest_name", "change_price", "change_type", "pay_way", "create_time", "remarks", "stay_type", "stay_date") VALUES (8, 'O202510194372', '101', '王维', '288.00', '房费', '微邮付', '2025-10-19T04:13:21.571Z', '第 1 天房费', '客房', '2025-10-17T16:00:00.000Z');
INSERT INTO "bills" ("bill_id", "order_id", "room_number", "guest_name", "change_price", "change_type", "pay_way", "create_time", "remarks", "stay_type", "stay_date") VALUES (9, 'O202510237359', '209', 'yg', '368.00', '房费', '微邮付', '2025-10-23T07:06:15.481Z', '第 1 天房费', '客房', '2025-10-22T16:00:00.000Z');

-- handover 表数据 (8 条记录)
INSERT INTO "handover" ("id", "date", "handover_person", "takeover_person", "vip_card", "payment_type", "reserve_cash", "room_income", "rest_income", "rent_income", "total_income", "room_refund", "rest_refund", "retained", "handover", "task_list", "remarks") VALUES (1, '2025-10-17T16:00:00.000Z', 'youtao', '韩信', 7, 1, '0.00', '0.00', '0.00', '0.00', '0.00', '0.00', '0.00', '0.00', '0.00', '[]', '');
INSERT INTO "handover" ("id", "date", "handover_person", "takeover_person", "vip_card", "payment_type", "reserve_cash", "room_income", "rest_income", "rent_income", "total_income", "room_refund", "rest_refund", "retained", "handover", "task_list", "remarks") VALUES (2, '2025-10-17T16:00:00.000Z', 'youtao', '韩信', 0, 2, '320.00', '0.00', '0.00', '0.00', '320.00', '0.00', '0.00', '0.00', '320.00', '[]', '');
INSERT INTO "handover" ("id", "date", "handover_person", "takeover_person", "vip_card", "payment_type", "reserve_cash", "room_income", "rest_income", "rent_income", "total_income", "room_refund", "rest_refund", "retained", "handover", "task_list", "remarks") VALUES (3, '2025-10-17T16:00:00.000Z', 'youtao', '韩信', 0, 3, '543.00', '576.00', '0.00', '0.00', '1119.00', '0.00', '0.00', '0.00', '1119.00', '[]', '');
INSERT INTO "handover" ("id", "date", "handover_person", "takeover_person", "vip_card", "payment_type", "reserve_cash", "room_income", "rest_income", "rent_income", "total_income", "room_refund", "rest_refund", "retained", "handover", "task_list", "remarks") VALUES (4, '2025-10-17T16:00:00.000Z', 'youtao', '韩信', 0, 4, '432.00', '0.00', '0.00', '0.00', '432.00', '0.00', '0.00', '0.00', '432.00', '[]', '');
INSERT INTO "handover" ("id", "date", "handover_person", "takeover_person", "vip_card", "payment_type", "reserve_cash", "room_income", "rest_income", "rent_income", "total_income", "room_refund", "rest_refund", "retained", "handover", "task_list", "remarks") VALUES (10, '2025-10-16T16:00:00.000Z', 'youtao', '王维', 0, 1, '320.00', '0.00', '0.00', '0.00', '320.00', '0.00', '0.00', '320.00', '0.00', '[]', NULL);
INSERT INTO "handover" ("id", "date", "handover_person", "takeover_person", "vip_card", "payment_type", "reserve_cash", "room_income", "rest_income", "rent_income", "total_income", "room_refund", "rest_refund", "retained", "handover", "task_list", "remarks") VALUES (11, '2025-10-16T16:00:00.000Z', 'youtao', '王维', 0, 2, '321.00', '1.00', '2.00', '3.00', '320.00', '0.00', '0.00', '0.00', '320.00', '[]', NULL);
INSERT INTO "handover" ("id", "date", "handover_person", "takeover_person", "vip_card", "payment_type", "reserve_cash", "room_income", "rest_income", "rent_income", "total_income", "room_refund", "rest_refund", "retained", "handover", "task_list", "remarks") VALUES (13, '2025-10-16T16:00:00.000Z', 'youtao', '王维', 0, 3, '322.00', '0.00', '0.00', '0.00', '320.00', '0.00', '0.00', '0.00', '543.00', '[]', NULL);
INSERT INTO "handover" ("id", "date", "handover_person", "takeover_person", "vip_card", "payment_type", "reserve_cash", "room_income", "rest_income", "rent_income", "total_income", "room_refund", "rest_refund", "retained", "handover", "task_list", "remarks") VALUES (14, '2025-10-16T16:00:00.000Z', 'youtao', '王维', 0, 4, '320.00', '0.00', '0.00', '0.00', '320.00', '0.00', '0.00', '0.00', '432.00', '[]', NULL);

-- order_changes 表无数据

-- orders 表数据 (6 条记录)
INSERT INTO "orders" ("order_id", "id_source", "order_source", "guest_name", "phone", "room_type", "room_number", "check_in_date", "check_out_date", "status", "payment_method", "total_price", "deposit", "create_time", "stay_type", "remarks") VALUES ('O202510110372', '', 'front_desk', '吴友桃', '19951339211', 'yi_jiang_nan', '211', '2025-10-10T16:00:00.000Z', '2025-10-11T16:00:00.000Z', 'checked-out', '微邮付', '268.00', '100.00', '2025-10-11T04:55:30.620Z', '客房', '');
INSERT INTO "orders" ("order_id", "id_source", "order_source", "guest_name", "phone", "room_type", "room_number", "check_in_date", "check_out_date", "status", "payment_method", "total_price", "deposit", "create_time", "stay_type", "remarks") VALUES ('O202510121253', '', 'front_desk', 'wuuy', '16254712547', 'yi_jiang_nan', '205', '2025-10-11T16:00:00.000Z', '2025-10-12T16:00:00.000Z', 'checked-out', '微邮付', '268.00', '100.00', '2025-10-11T22:17:47.438Z', '客房', '');
INSERT INTO "orders" ("order_id", "id_source", "order_source", "guest_name", "phone", "room_type", "room_number", "check_in_date", "check_out_date", "status", "payment_method", "total_price", "deposit", "create_time", "stay_type", "remarks") VALUES ('O202510192045', '', 'front_desk', '李白', '', 'asu_xiao_zhu', '101', '2025-10-18T16:00:00.000Z', '2025-10-19T16:00:00.000Z', 'checked-in', '微邮付', '288.00', '0.00', '2025-10-19T04:12:31.571Z', '客房', '');
INSERT INTO "orders" ("order_id", "id_source", "order_source", "guest_name", "phone", "room_type", "room_number", "check_in_date", "check_out_date", "status", "payment_method", "total_price", "deposit", "create_time", "stay_type", "remarks") VALUES ('O202510194372', '', 'front_desk', '王维', '', 'asu_xiao_zhu', '101', '2025-10-17T16:00:00.000Z', '2025-10-18T16:00:00.000Z', 'checked-in', '微邮付', '288.00', '0.00', '2025-10-19T04:13:18.202Z', '客房', '');
INSERT INTO "orders" ("order_id", "id_source", "order_source", "guest_name", "phone", "room_type", "room_number", "check_in_date", "check_out_date", "status", "payment_method", "total_price", "deposit", "create_time", "stay_type", "remarks") VALUES ('O202510237359', '', 'front_desk', 'yg', '', 'nuan_ju_jiating', '209', '2025-10-22T16:00:00.000Z', '2025-10-23T16:00:00.000Z', 'checked-in', '微邮付', '368.00', '0.00', '2025-10-22T23:06:09.783Z', '客房', '');
INSERT INTO "orders" ("order_id", "id_source", "order_source", "guest_name", "phone", "room_type", "room_number", "check_in_date", "check_out_date", "status", "payment_method", "total_price", "deposit", "create_time", "stay_type", "remarks") VALUES ('O202EXT101120558459', 'O202510110372', 'extend_stay', '吴友桃[续2367]', '19951339211', 'yi_jiang_nan', '211', '2025-10-10T16:00:00.000Z', '2025-10-11T16:00:00.000Z', 'checked-out', '现金', '268.00', '0.00', '2025-10-11T04:55:52.368Z', '客房', '续住订单，原客人：吴友桃，原订单号：O202510110372。');

-- review_invitations 表数据 (1 条记录)
INSERT INTO "review_invitations" ("id", "order_id", "invited", "positive_review", "invite_time", "update_time") VALUES (1, 'O202510121253', TRUE, TRUE, '2025-10-11T22:18:11.863Z', '2025-10-11T22:18:14.369Z');

-- room_types 表数据 (9 条记录)
INSERT INTO "room_types" ("type_code", "type_name", "base_price", "description", "is_closed") VALUES ('asu_xiao_zhu', '阿苏晓筑', '288.00', '舒适的日式风格房间，温馨宁静', FALSE);
INSERT INTO "room_types" ("type_code", "type_name", "base_price", "description", "is_closed") VALUES ('bo_ye_shuang', '泊野双床', '258.00', '双床配置，适合朋友或同事入住', FALSE);
INSERT INTO "room_types" ("type_code", "type_name", "base_price", "description", "is_closed") VALUES ('nuan_ju_jiating', '暖居家庭房', '368.00', '温馨家庭房，适合全家出行', FALSE);
INSERT INTO "room_types" ("type_code", "type_name", "base_price", "description", "is_closed") VALUES ('sheng_sheng_man', '声声慢投影大床', '348.00', '配备投影设备的大床房，适合观影休闲', FALSE);
INSERT INTO "room_types" ("type_code", "type_name", "base_price", "description", "is_closed") VALUES ('xing_yun_ge', '行云阁', '388.00', '带有私人院子的特色房型，闹中取静', FALSE);
INSERT INTO "room_types" ("type_code", "type_name", "base_price", "description", "is_closed") VALUES ('yi_jiang_nan', '忆江南大床房', '268.00', '江南风格装修的大床房，典雅舒适', FALSE);
INSERT INTO "room_types" ("type_code", "type_name", "base_price", "description", "is_closed") VALUES ('you_ge_yuan_zi', '有个院子', '130.00', NULL, FALSE);
INSERT INTO "room_types" ("type_code", "type_name", "base_price", "description", "is_closed") VALUES ('yun_ju_ying_yin', '云居云端影音房', '428.00', '顶级影音设备配置，享受云端视听体验', FALSE);
INSERT INTO "room_types" ("type_code", "type_name", "base_price", "description", "is_closed") VALUES ('zui_shan_tang', '醉山塘', '398.00', '山塘街风格装修，体验古典江南韵味', FALSE);

-- rooms 表数据 (40 条记录)
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (6, '201', 'sheng_sheng_man', 'available', '348.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (7, '202', 'bo_ye_shuang', 'available', '258.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (505, '111', 'asu_xiao_zhu', 'available', '288.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (506, '113', 'you_ge_yuan_zi', 'cleaning', '388.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (507, '115', 'you_ge_yuan_zi', 'available', '388.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (508, '117', 'you_ge_yuan_zi', 'available', '388.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (509, '211', 'yi_jiang_nan', 'cleaning', '268.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (510, '311', 'yi_jiang_nan', 'available', '268.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (511, '312', 'yi_jiang_nan', 'available', '268.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (512, '307', 'bo_ye_shuang', 'available', '258.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (513, '308', 'bo_ye_shuang', 'available', '258.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (514, '209', 'nuan_ju_jiating', 'occupied', '368.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (515, '210', 'nuan_ju_jiating', 'available', '368.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (516, '212', 'nuan_ju_jiating', 'available', '368.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (517, '309', 'nuan_ju_jiating', 'available', '368.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (518, '310', 'nuan_ju_jiating', 'available', '368.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (519, '112', 'zui_shan_tang', 'available', '398.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (520, '116', 'zui_shan_tang', 'available', '398.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (521, '101', 'asu_xiao_zhu', 'occupied', '288.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (522, '102', 'asu_xiao_zhu', 'available', '288.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (523, '103', 'asu_xiao_zhu', 'available', '288.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (524, '105', 'asu_xiao_zhu', 'available', '288.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (525, '106', 'asu_xiao_zhu', 'available', '288.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (526, '107', 'asu_xiao_zhu', 'available', '288.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (527, '108', 'asu_xiao_zhu', 'available', '288.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (528, '109', 'asu_xiao_zhu', 'available', '288.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (529, '110', 'asu_xiao_zhu', 'available', '288.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (530, '203', 'sheng_sheng_man', 'available', '348.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (531, '205', 'yi_jiang_nan', 'cleaning', '268.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (532, '206', 'bo_ye_shuang', 'available', '258.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (533, '207', 'bo_ye_shuang', 'available', '258.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (534, '208', 'bo_ye_shuang', 'available', '258.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (535, '301', 'sheng_sheng_man', 'available', '348.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (536, '302', 'bo_ye_shuang', 'available', '258.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (537, '303', 'sheng_sheng_man', 'available', '348.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (538, '305', 'yi_jiang_nan', 'available', '268.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (539, '306', 'bo_ye_shuang', 'available', '258.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (540, '401', 'yun_ju_ying_yin', 'available', '428.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (541, '402', 'yun_ju_ying_yin', 'available', '428.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (542, '403', 'xing_yun_ge', 'available', '388.00', FALSE);
