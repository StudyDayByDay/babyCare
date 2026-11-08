const session = require('../services/session.js')

module.exports = Behavior({
  data: {
    elder: false,
    ready: false,
    pageError: ''
  },
  methods: {
    prepare() {
      return session.ensure().then((data) => {
        const elder = !!(data.member && data.member.elderMode)
        this.setData({ elder, ready: true, pageError: '' })
        return data
      })
    },
    syncTab(index, elder) {
      if (typeof this.getTabBar === 'function' && this.getTabBar()) {
        this.getTabBar().setData({
          selected: index,
          elder: elder != null ? elder : this.data.elder
        })
      }
    },
    toast(message) {
      wx.showToast({ title: message || '没有完成', icon: 'none' })
    },
    fail(err) {
      this.toast(err && err.message ? err.message : '没有完成')
    }
  }
})
