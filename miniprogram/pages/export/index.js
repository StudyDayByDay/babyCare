const pageBehavior = require('../../behaviors/page.js')
const api = require('../../services/api.js')
const { dayKey, addDays, durationText, prettyDay } = require('../../utils/date.js')
const { buildVisitText } = require('../../utils/view.js')

Page({
  behaviors: [pageBehavior],
  data: {
    loading: true,
    pageError: '',
    span: 7,
    days: [],
    totals: {},
    hasData: false,
    sleepText: '',
    saving: false
  },
  onShow() {
    this.reload()
  },
  retry() {
    this.setData({ pageError: '', loading: true })
    this.reload()
  },
  reload() {
    if (!this.loaded) this.setData({ loading: true })
    return this.prepare().then((session) => {
      if (!session.baby) {
        wx.navigateBack()
        return null
      }
      this.baby = session.baby
      return this.load()
    }).then(() => {
      this.loaded = true
      this.setData({ loading: false, pageError: '' })
    }).catch((err) => {
      this.loaded = true
      this.setData({ loading: false, pageError: err.message || '云服务没有连上' })
    })
  },
  load() {
    const endDay = dayKey()
    const startDay = addDays(endDay, -(this.data.span - 1))
    this.rangeQuery = { babyId: this.baby._id, startDay, endDay }
    return api.getRange(this.rangeQuery).then((range) => {
      this.range = range
      const totals = range.totals || {}
      const hasData = !!(
        totals.feedCount || totals.diaperCount || totals.sleepMin || totals.medTotal
      )
      this.setData({
        totals,
        hasData,
        sleepText: durationText(totals.sleepMin),
        days: range.days.map((day) => Object.assign({
          pretty: prettyDay(day.day),
          sleepText: durationText(day.sleepMin)
        }, day))
      })
    })
  },
  onSpan(e) {
    const span = Number(e.currentTarget.dataset.span)
    if (span === this.data.span) return
    this.setData({ span })
    this.load().catch((err) => this.fail(err))
  },
  copy() {
    if (!this.range) return
    wx.setClipboardData({
      data: buildVisitText(this.baby, this.range),
      success: () => this.ok('已复制')
    })
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
    })).then(() => {
      this.setData({ saving: false })
      this.ok('表格已打开')
    }).catch((err) => {
      this.setData({ saving: false })
      const message = err && err.message ? err.message : '表格没有打开'
      this.toast(message)
    })
  },
  goRecord() {
    wx.switchTab({ url: '/pages/record/index' })
  }
})
