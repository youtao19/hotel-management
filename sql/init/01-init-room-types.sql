-- 初始化房间类型数据

INSERT INTO room_types (type_code, type_name, base_price, description, is_closed) VALUES 
('sheng_sheng_man', '声声慢投影大床', 348.00, '配备投影设备的大床房，适合观影休闲', false),
('yi_jiang_nan', '忆江南大床房', 268.00, '江南风格装修的大床房，典雅舒适', false),
('yun_ju_ying_yin', '云居云端影音房', 428.00, '顶级影音设备配置，享受云端视听体验', false),
('bo_ye_shuang', '泊野双床', 258.00, '双床配置，适合朋友或同事入住', false),
('nuan_ju_jiating', '暖居家庭房', 368.00, '温馨家庭房，适合全家出行', false),
('zui_shan_tang', '醉山塘', 398.00, '山塘街风格装修，体验古典江南韵味', false),
('asu_xiao_zhu', '阿苏晓筑', 288.00, '舒适的日式风格房间，温馨宁静', false),
('xing_yun_ge', '行云阁', 388.00, '带有私人院子的特色房型，闹中取静', false),
('you_ge_yuan_zi', '有个院子', 130.00, null, false)
ON CONFLICT (type_code) DO NOTHING;
