-- room_types 数据
INSERT INTO "room_types" ("type_code", "type_name", "base_price", "description", "is_closed") VALUES ('standard', '标准间', '288.00', '舒适标准双人间，配备基础设施', FALSE);
INSERT INTO "room_types" ("type_code", "type_name", "base_price", "description", "is_closed") VALUES ('deluxe', '豪华间', '388.00', '豪华装修双人间，配备高档设施', FALSE);
INSERT INTO "room_types" ("type_code", "type_name", "base_price", "description", "is_closed") VALUES ('suite', '套房', '588.00', '独立客厅与卧室，尊享舒适空间', FALSE);
INSERT INTO "room_types" ("type_code", "type_name", "base_price", "description", "is_closed") VALUES ('presidential', '总统套房', '1288.00', '顶级豪华套房，配备全套高端设施与服务', FALSE);
INSERT INTO "room_types" ("type_code", "type_name", "base_price", "description", "is_closed") VALUES ('family', '家庭房', '688.00', '适合家庭入住的宽敞房间，配备儿童设施', FALSE);

-- rooms 数据
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (106, '106', 'standard', 'available', '288.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (107, '107', 'standard', 'available', '288.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (108, '108', 'standard', 'available', '288.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (109, '109', 'standard', 'available', '288.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (110, '110', 'standard', 'available', '288.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (6, '201', 'deluxe', 'available', '388.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (8, '203', 'deluxe', 'available', '388.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (205, '205', 'deluxe', 'available', '388.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (206, '206', 'deluxe', 'available', '388.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (207, '207', 'deluxe', 'available', '388.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (208, '208', 'deluxe', 'available', '388.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (210, 'A201', 'deluxe', 'available', '428.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (211, 'A202', 'deluxe', 'available', '428.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (212, 'A203', 'deluxe', 'available', '428.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (10, '301', 'suite', 'available', '588.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (12, '303', 'suite', 'cleaning', '588.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (304, '304', 'suite', 'available', '588.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (305, '305', 'suite', 'available', '588.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (306, '306', 'suite', 'available', '588.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (401, '401', 'presidential', 'available', '1288.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (402, '402', 'presidential', 'available', '1288.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (501, '501', 'family', 'available', '688.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (503, '503', 'family', 'available', '688.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (9, '204', 'deluxe', 'available', '388.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (403, '403', 'presidential', 'available', '1588.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (502, '502', 'family', 'available', '688.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (504, '504', 'family', 'available', '688.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (2, '102', 'standard', 'available', '288.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (4, '104', 'standard', 'cleaning', '288.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (3, '103', 'standard', 'repair', '288.00', TRUE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (5, '105', 'standard', 'available', '288.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (11, '302', 'suite', 'available', '588.00', FALSE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (7, '202', 'deluxe', 'repair', '388.00', TRUE);
INSERT INTO "rooms" ("room_id", "room_number", "type_code", "status", "price", "is_closed") VALUES (1, '101', 'standard', 'cleaning', '288.00', FALSE);

-- orders 数据
INSERT INTO "orders" ("order_id", "id_source", "order_source", "guest_name", "phone", "id_number", "room_type", "room_number", "check_in_date", "check_out_date", "status", "payment_method", "room_price", "deposit", "create_time", "remarks") VALUES ('O202506062995', '', 'front_desk', '王英', '15809314697', '110101199002218173', 'suite', '304', '2025-06-05T16:00:00.000Z', '2025-06-06T16:00:00.000Z', 'pending', 'card', '588.00', '185.00', '2025-06-06T02:20:43.519Z', '随机生成的测试订单 - 2025/6/6 10:20:39');
INSERT INTO "orders" ("order_id", "id_source", "order_source", "guest_name", "phone", "id_number", "room_type", "room_number", "check_in_date", "check_out_date", "status", "payment_method", "room_price", "deposit", "create_time", "remarks") VALUES ('O202506066923', '', 'front_desk', '刘英', '18726316320', '110101199001201906', 'standard', '102', '2025-06-01T16:00:00.000Z', '2025-06-02T16:00:00.000Z', 'pending', 'card', '288.00', '208.00', '2025-06-06T06:26:31.115Z', '随机生成的测试订单 - 2025/6/6 14:26:18');
