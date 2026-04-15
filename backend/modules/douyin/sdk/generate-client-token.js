const fetch = require('node-fetch');
const { douyinConfig } = require('../../../appSettings/douyin.config');

async function getClientToken() {
  try {
    const response = await fetch('https://open.douyin.com/oauth/client_token/', {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        'grant_type': 'client_credential',
        'client_key': douyinConfig.clientKey,
        'client_secret': douyinConfig.clientSecret
      })
    })

    const data = await response.json()
    console.log('Client token response:', data)
    if (data.data.message === 'success') {
      return data.data.access_token
    } else {
      throw new Error(`Failed to get client token: ${data.data.description}`)
    }
  } catch (error) {
    console.error('Error generating client token:', error)
    throw error
  }
}

module.exports = {
  getClientToken,
}


