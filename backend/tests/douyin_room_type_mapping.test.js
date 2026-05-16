const express = require('express');
const request = require('supertest');

jest.mock('../modules/douyin/token/token.service', () => ({
  getToken: jest.fn()
}));

const { query } = require('../database/postgreDB/pg');
const douyinTokenService = require('../modules/douyin/token/token.service');
const douyinRoomTypeMappingRoute = require('../modules/douyin/room-type-mapping/roomTypeMapping.routes');

const originalFetch = global.fetch;

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/douyin/room-type-mapping', douyinRoomTypeMappingRoute);
  return app;
}

async function createRoomType(typeCode, typeName = `测试房型-${typeCode}`) {
  await query(
    `
      INSERT INTO room_types (type_code, type_name, base_price, description)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (type_code) DO UPDATE
      SET type_name = EXCLUDED.type_name,
          base_price = EXCLUDED.base_price,
          description = EXCLUDED.description
    `,
    [typeCode, typeName, 299, '抖音房型匹配测试']
  );
}

async function createDouyinRoom(roomId, roomName = `抖音房型-${roomId}`) {
  await query(
    `
      INSERT INTO douyin_physical_rooms
        (account_id, room_id, room_name, status, raw_payload, rate_plan_list)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (room_id) DO UPDATE
      SET room_name = EXCLUDED.room_name,
          raw_payload = EXCLUDED.raw_payload,
          updated_at = CURRENT_TIMESTAMP
    `,
    [
      'DY_ACCOUNT_001',
      roomId,
      roomName,
      1,
      { hotel_id: 'DY_HOTEL_001', active: true },
      []
    ]
  );
}

describe('抖音房型匹配管理', () => {
  const app = buildTestApp();

  beforeEach(async () => {
    await query('DELETE FROM douyin_room_type_mapping');
    await query('DELETE FROM douyin_physical_rooms');
    await query("DELETE FROM room_types WHERE type_code LIKE 'DY_MAP_%'");
    douyinTokenService.getToken.mockReset();
    global.fetch = jest.fn();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  test('查询房型匹配列表会返回本地房型和抖音房型缓存', async () => {
    await createRoomType('DY_MAP_A', '本地房型A');
    await createDouyinRoom('DY_ROOM_A', '抖音房型A');
    await query(
      `
        INSERT INTO douyin_room_type_mapping
          (douyin_room_id, douyin_room_name, local_room_type)
        VALUES ($1, $2, $3)
      `,
      ['DY_ROOM_A', '抖音房型A', 'DY_MAP_A']
    );

    const response = await request(app).get('/api/douyin/room-type-mapping');

    expect(response.statusCode).toBe(200);
    expect(response.body.data.summary.matchedCount).toBe(1);
    expect(response.body.data.items[0]).toMatchObject({
      localRoomType: 'DY_MAP_A',
      localRoomTypeName: '本地房型A',
      douyinRoomId: 'DY_ROOM_A',
      matchStatus: 'MATCHED'
    });
    expect(response.body.data.douyinRooms[0]).toMatchObject({
      roomId: 'DY_ROOM_A',
      roomName: '抖音房型A',
      boundLocalRoomType: 'DY_MAP_A'
    });
  });

  test('刷新抖音房型会写入物理房型缓存', async () => {
    await createRoomType('DY_MAP_A', '本地房型A');
    douyinTokenService.getToken.mockResolvedValue('TOKEN_001');
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          error_code: 0,
          description: '',
          room_lists: {
            DY_HOTEL_001: [
              {
                room_id: 'DY_ROOM_A',
                cn_name: '抖音房型A',
                active: true
              }
            ]
          }
        },
        extra: {
          error_code: 0,
          description: '',
          logid: 'DY_ROOM_LOG_001'
        }
      })
    });

    const response = await request(app)
      .post('/api/douyin/room-type-mapping/refresh')
      .send({
        accountId: 'DY_ACCOUNT_001',
        poiId: 'DY_HOTEL_001'
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.data.refresh.savedCount).toBe(1);
    expect(response.body.data.refresh.logId).toBe('DY_ROOM_LOG_001');
    expect(response.body.data.douyinRooms[0]).toMatchObject({
      roomId: 'DY_ROOM_A',
      roomName: '抖音房型A',
      accountId: 'DY_ACCOUNT_001',
      hotelId: 'DY_HOTEL_001'
    });

    const roomResult = await query('SELECT raw_payload FROM douyin_physical_rooms WHERE room_id = $1', ['DY_ROOM_A']);
    expect(roomResult.rows[0].raw_payload).toMatchObject({
      room_id: 'DY_ROOM_A',
      hotel_id: 'DY_HOTEL_001',
      poi_id: 'DY_HOTEL_001'
    });
  });

  test('保存房型匹配时要求抖音房型缓存存在', async () => {
    await createRoomType('DY_MAP_A', '本地房型A');

    const response = await request(app)
      .post('/api/douyin/room-type-mapping')
      .send({
        mappings: [
          {
            localRoomType: 'DY_MAP_A',
            douyinRoomId: 'MISSING_ROOM'
          }
        ]
      });

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toContain('抖音物理房型缓存不存在');
  });

  test('保存和解除房型匹配成功', async () => {
    await createRoomType('DY_MAP_A', '本地房型A');
    await createDouyinRoom('DY_ROOM_A', '抖音房型A');

    const saveResponse = await request(app)
      .post('/api/douyin/room-type-mapping')
      .send({
        mappings: [
          {
            localRoomType: 'DY_MAP_A',
            douyinRoomId: 'DY_ROOM_A'
          }
        ]
      });

    expect(saveResponse.statusCode).toBe(200);
    expect(saveResponse.body.data.items[0]).toMatchObject({
      localRoomType: 'DY_MAP_A',
      douyinRoomId: 'DY_ROOM_A',
      matchStatus: 'MATCHED'
    });

    const deleteResponse = await request(app).delete('/api/douyin/room-type-mapping/DY_MAP_A');

    expect(deleteResponse.statusCode).toBe(200);
    expect(deleteResponse.body.data.items[0]).toMatchObject({
      localRoomType: 'DY_MAP_A',
      douyinRoomId: null,
      matchStatus: 'UNMATCHED'
    });
  });

  test('同一个抖音房型不能绑定到多个本地房型', async () => {
    await createRoomType('DY_MAP_A', '本地房型A');
    await createRoomType('DY_MAP_B', '本地房型B');
    await createDouyinRoom('DY_ROOM_A', '抖音房型A');
    await query(
      `
        INSERT INTO douyin_room_type_mapping
          (douyin_room_id, douyin_room_name, local_room_type)
        VALUES ($1, $2, $3)
      `,
      ['DY_ROOM_A', '抖音房型A', 'DY_MAP_A']
    );

    const response = await request(app)
      .post('/api/douyin/room-type-mapping')
      .send({
        mappings: [
          {
            localRoomType: 'DY_MAP_B',
            douyinRoomId: 'DY_ROOM_A'
          }
        ]
      });

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('抖音房型 DY_ROOM_A 已绑定本地房型 DY_MAP_A');
  });
});
