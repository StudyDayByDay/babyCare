const pageBehavior = require('../../behaviors/page.js')
const api = require('../../services/api.js')
const { dayKey, addDays, durationText, prettyDay } = require('../../utils/date.js')
const { openDay } = require('../../utils/nav.js')

Page({
  behaviors: [pageBehavior],
  data: {
    loading: true,
    needBaby: false,
    span: 7,
    days: [],
    totals: null,
    sleepText: '',
    hasData: false
  },
  onShow() {
    this.reload()
  },
  onPullDownRefresh() {
    this.reload().finally(() => wx.stopPullDownRefresh())
  },
  retry() {
    this.setData({ pageError: '', loading: true })
    this.reload()
  },
  reload() {
    if (!this.loaded) this.setData({ loading: true })
    return this.prepare().then((session) => {
      this.syncTab(2, !!(session.member && session.member.elderMode))
      if (!session.baby) {
        this.loaded = true
        this.setData({ needBaby: true, loading: false, pageError: '' })
        return null
      }
      this.baby = session.baby
      return this.load()
    }).then(() => {
      this.loaded = true
      this.setData({ loading: false })
    }).catch((err) => {
      this.loaded = true
      this.setData({ loading: false, pageError: err.message || '云服务没有连上' })
    })
  },
  load() {
    const endDay = dayKey()
    const startDay = addDays(endDay, -(this.data.span - 1))
    return api.getRange({ babyId: this.baby._id, startDay, endDay }).then((range) => {
      const max = Math.max.apply(null, range.days.map((day) => day.feedCount).concat([1]))
      const totals = range.totals || {}
      const hasData = !!(
        totals.feedCount || totals.formulaMl || totals.breastMin ||
        totals.poopCount || totals.sleepMin || totals.medTotal
      )
      this.setData({
        totals,
        sleepText: durationText(totals.sleepMin),
        hasData,
        days: range.days.map((day) => Object.assign({
          pretty: prettyDay(day.day),
          feedWidth: Math.round(day.feedCount / max * 100)
        }, day)),
        pageError: ''
      })
    })
  },
  onSpan(e) {
    const span = Number(e.currentTarget.dataset.span)
    if (span === this.data.span) return
    this.setData({ span })
    this.load().catch((err) => this.fail(err))
  },
  openDay(e) {
    openDay(e.currentTarget.dataset.day)
  },
  goExport() {
    wx.navigateTo({ url: '/pages/export/index' })
  },
  goRecord() {
    wx.switchTab({ url: '/pages/record/index' })
  },
  goBaby() {
    wx.navigateTo({ url: '/pages/baby-edit/index' })
  }
})
