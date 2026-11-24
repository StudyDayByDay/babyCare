const pageBehavior = require('../../behaviors/page.js')
const api = require('../../services/api.js')
const { dayKey, prettyDay, stageOf, addDays } = require('../../utils/date.js')
const { recordActions, hiddenCareActions } = require('../../utils/stage.js')
const { ledgerRows } = require('../../utils/view.js')
const { openAction } = require('../../utils/nav.js')

Page({
  behaviors: [pageBehavior],
  data: {
    loading: true,
    needBaby: false,
    baby: null,
    day: '',
    pretty: '',
    isToday: true,
    primaryActions: [],
    extraActions: [],
    showMore: false,
    ledger: [],
    feedCount: 0,
    totalMl: 0,
    bottleBreastMl: 0,
    formulaMl: 0,
    breastMin: 0,
    diaperCount: 0,
    peeCount: 0,
    poopCount: 0,
    sleepHours: '0'
  },
  onShow() {
    const stored = wx.getStorageSync('ledgerDay')
    if (stored) {
      wx.removeStorageSync('ledgerDay')
      this.pickedDay = stored
    }
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
      this.syncTab(1, !!(session.member && session.member.elderMode))
      if (!session.baby) {
        this.loaded = true
        this.setData({ needBaby: true, loading: false, pageError: '' })
        return null
      }
      const day = this.pickedDay || this.data.day || dayKey()
      this.pickedDay = ''
      const stage = stageOf(session.baby.birthday, day)
      const actions = recordActions(stage)
      const more = hiddenCareActions(stage)
      this.setData({
        needBaby: false,
        pageError: '',
        baby: session.baby,
        day,
        pretty: prettyDay(day),
        isToday: day === dayKey(),
        primaryActions: actions.slice(0, 4),
        extraActions: actions.slice(4).concat(more)
      })
      return api.getDay({ babyId: session.baby._id, day }).then((data) => {
        const summary = data.summary || {}
        const formulaMl = Number(summary.formulaMl) || 0
        const breastMl = Number(summary.bottleBreastMl) || 0
        const sleepMin = Number(summary.sleepMin) || 0
        this.setData({
          ledger: ledgerRows(data.records, data.doses),
          feedCount: Number(summary.feedCount) || 0,
          totalMl: formulaMl + breastMl,
          bottleBreastMl: breastMl,
          formulaMl,
          breastMin: Number(summary.breastMin) || 0,
          diaperCount: Number(summary.diaperCount) || 0,
          peeCount: Number(summary.peeCount) || 0,
          poopCount: Number(summary.poopCount) || 0,
          sleepHours: String(Math.round(sleepMin / 6) / 10),
          pageError: ''
        })
      })
    }).then(() => {
      this.loaded = true
      this.setData({ loading: false })
    }).catch((err) => {
      this.loaded = true
      this.setData({ loading: false, pageError: err.message || '云服务没有连上' })
    })
  },
  shift(e) {
    const dir = Number(e.currentTarget.dataset.dir)
    this.pickedDay = addDays(this.data.day || dayKey(), dir)
    this.reload()
  },
  onDate(e) {
    this.pickedDay = e.detail.value
    this.reload()
  },
  goToday() {
    this.pickedDay = dayKey()
    this.reload()
  },
  goStats() {
    wx.switchTab({ url: '/pages/stats/index' })
  },
  toggleMore() {
    this.setData({ showMore: !this.data.showMore })
  },
  onAction(e) {
    openAction(e.currentTarget.dataset.key, this.data.day)
  },
  openLine(e) {
    const kind = e.currentTarget.dataset.kind
    if (kind === 'dose') {
      wx.navigateTo({ url: '/pages/med-list/index?day=' + this.data.day })
      return
    }
    wx.navigateTo({
      url: '/pages/event-edit/index?type=' + e.currentTarget.dataset.type + '&id=' + e.currentTarget.dataset.id + '&day=' + this.data.day
    })
  },
  goBaby() {
    wx.navigateTo({ url: '/pages/baby-edit/index' })
  }
})
