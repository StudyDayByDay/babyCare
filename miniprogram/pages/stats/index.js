const pageBehavior = require('../../behaviors/page.js')
const api = require('../../services/api.js')
const { dayKey, addDays, durationText } = require('../../utils/date.js')
const { openDay } = require('../../utils/nav.js')

Page({
  behaviors: [pageBehavior],
  data: { needBaby: false, span: 7, days: [], totals: null, sleepText: '' },
  onShow() {
    this.reload()
  },
  onPullDownRefresh() {
    this.reload().finally(() => wx.stopPullDownRefresh())
  },
  reload() {
    return this.prepare().then((session) => {
      this.syncTab(2, !!(session.member && session.member.elderMode))
      if (!session.baby) {
        this.setData({ needBaby: true })
        return null
      }
      this.baby = session.baby
      return this.load()
    }).catch((err) => this.fail(err))
  },
  load() {
    const endDay = dayKey()
    const startDay = addDays(endDay, -(this.data.span - 1))
    return api.getRange({ babyId: this.baby._id, startDay, endDay }).then((range) => {
      const max = Math.max.apply(null, range.days.map((day) => day.feedCount).concat([1]))
      this.setData({
        totals: range.totals,
        sleepText: durationText(range.totals.sleepMin),
        days: range.days.map((day) => Object.assign({ feedWidth: Math.round(day.feedCount / max * 100) }, day))
      })
    })
  },
  onSpan(e) {
    this.setData({ span: Number(e.currentTarget.dataset.span) })
    this.load().catch((err) => this.fail(err))
  },
  openDay(e) {
    openDay(e.currentTarget.dataset.day)
  },
  goExport() {
    wx.navigateTo({ url: '/pages/export/index' })
  },
  goBaby() {
    wx.navigateTo({ url: '/pages/baby-edit/index' })
  }
})
