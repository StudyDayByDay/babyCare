const pageBehavior = require('../../behaviors/page.js')
const api = require('../../services/api.js')
const { dayKey, addDays, durationText } = require('../../utils/date.js')
const { buildVisitText } = require('../../utils/view.js')

Page({
  behaviors: [pageBehavior],
  data: { span: 7, days: [], saving: false },
  onShow() {
    this.prepare().then((session) => {
      if (!session.baby) {
        wx.navigateBack()
        return
      }
      this.baby = session.baby
      return this.load()
    }).catch((err) => this.fail(err))
  },
  load() {
    const endDay = dayKey()
    const startDay = addDays(endDay, -(this.data.span - 1))
    this.rangeQuery = { babyId: this.baby._id, startDay, endDay }
    return api.getRange(this.rangeQuery).then((range) => {
      this.range = range
      this.setData({
        days: range.days.map((day) => Object.assign({
          poopText: day.poopBits && day.poopBits.length ? '（' + day.poopBits.join('、') + '）' : '',
          sleepText: durationText(day.sleepMin)
        }, day))
      })
    })
  },
  onSpan(e) {
    this.setData({ span: Number(e.currentTarget.dataset.span) })
    this.load().catch((err) => this.fail(err))
  },
  copy() {
    if (!this.range) return
    wx.setClipboardData({ data: buildVisitText(this.baby, this.range) })
  },
  makeFile() {
    if (this.data.saving || !this.rangeQuery) return
    this.setData({ saving: true })
    api.exportFile(this.rangeQuery).then((file) => new Promise((resolve, reject) => {
      wx.cloud.downloadFile({ fileID: file.fileID, success: resolve, fail: reject })
    })).then((down) => new Promise((resolve, reject) => {
      wx.openDocument({
        filePath: down.tempFilePath,
        fileType: 'xlsx',
        showMenu: true,
        success: resolve,
        fail: reject
      })
    })).catch((err) => {
      const message = err && err.message ? err.message : '表格没有打开'
      this.toast(message)
    }).then(() => this.setData({ saving: false }))
  }
})
