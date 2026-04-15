import fetch from 'node-fetch';
const { douyinConfig } = require('../../../appSettings/douyin.config');

async function getRatePlanId(params) {
  try {
    const response = await fetch('https://open.douyin.com/goodlife/v1/trip/physical_room/search/', {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        'account_id': douyinConfig.accountId,
        'poi_ids': [`${douyinConfig.poiId}`],
      })
    })

    const data = await response.json()
    console.log('Physical room type info response:', data)
    if (data.base_resp.status_message === 'success') {
      
    } else {
      throw new Error(`Failed to get physical room type info: ${data.data.description}`)
    }
  } catch (error) {
    console.error('Error getting physical room type info:', error)
    throw error
  }
}

