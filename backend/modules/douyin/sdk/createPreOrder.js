const { fetch } = require('node-fetch');
const { douyinConfig } = require('../../../appSettings/douyin.config');

fetch('https://open.douyin.com/goodlife/v1/trip/hotel/presale/rateplan/save/', {
  method: 'POST',
  headers: {
    'access-token': 're4g596ndd632bb8b3e445bda3a13684dedfc6ed649d6d5bdbedfe3cb2ce7c390fb65c80f74cc1da458acdca8e46a26066e45cfdd2c494cbb61f91e51b9c11cecf15b5bf90070d313e7a81598b8d03c9b7297590z8ncyqoc',
    'content-type': 'application/json'
  },
  body: JSON.stringify({
    'rate_plan': {
      'hotel_id': douyinConfig.hotelId,
      'rooms': [
        {
          'rate_plans': [
            {
              'out_rate_plan_id': '1855368646019115',
              'rate_plan_name': '测试大床房',
              'hourly_room_detail': {
                'earliest_check_in': '12:00',
                'latest_check_out': '14:00',
                'usage_duration': 22
              }
            }
          ],
          'room_id': '7524925764475619338'
        }
      ]
    },
    'account_id': douyinConfig.accountId
  })
});
