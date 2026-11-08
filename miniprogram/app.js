const config = require('./config.js')

App({
  globalData: {
    session: null,
    elder: false
  },
  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用支持云开发的基础库')
      return
    }
    const options = { traceUser: true }
    if (config.envId) options.env = config.envId
    wx.cloud.init(options)
  }
})
