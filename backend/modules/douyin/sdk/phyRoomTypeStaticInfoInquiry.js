import fetch from 'node-fetch';

fetch('https://open.douyin.com/goodlife/v1/trip/physical_room/query/', {
  method: 'POST',
  headers: {
    'access-token': 're4g596naae4d9aa7510b7e5d7918e84e65c8488c31e2fd3a7f127477502103a4892ce6057dd955cc2c4ba2943143a8c2607ab1bd4b750cdccee7797bc9baa4590628f9c5f8b0b69d423aece674c2e405d2bf2aez8ncyqoc',
    'content-type': 'application/json'
  },
  body: JSON.stringify({
    'account_id': '7507523790402750498',
    'room_ids': [
      '7599586770841389065',
      '7599586950890129448',
      '7599587135779358730',
      '7524925764475619338'
    ],
    'need_rate_plan': true
  })
});

