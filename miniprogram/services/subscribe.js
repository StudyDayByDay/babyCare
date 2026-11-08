const config = require('../config.js')
const api = require('./api.js')

function requestMedSubscribe() {
  const templateId = config.templateId
  if (!templateId) return Promise.resolve(false)
  return new Promise((resolve) => {
    wx.requestSubscribeMessage({
      tmplIds: [templateId],
      success(res) {
        if (res[templateId] === 'accept') {
          api.addQuota({ templateId }).then(() => resolve(true)).catch(() => resolve(false))
          return
        }
        resolve(false)
      },
      fail() {
        resolve(false)
      }
    })
  })
}

module.exports = {
  requestMedSubscribe,
  templateReady: !!config.templateId
}
