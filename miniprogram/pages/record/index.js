const pageBehavior = require('../../behaviors/page.js')
const api = require('../../services/api.js')
const { dayKey, prettyDay, stageOf, timeKey } = require('../../utils/date.js')
const { recordActions, hiddenCareActions, iconFor } = require('../../utils/stage.js')
const { openAction } = require('../../utils/nav.js')

Page({
  behaviors: [pageBehavior],
  data: {
    needBaby: false,
    baby: null,
    day: '',
    pretty: '',
    actions: [],
    more: [],
    showMore: false,
    records: []
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
  reload() {
    return this.prepare().then((session) => {
      this.syncTab(1, !!(session.member && session.member.elderMode))
      if (!session.baby) {
        this.setData({ needBaby: true })
        return null
      }
      const day = this.pickedDay || this.data.day || dayKey()
      this.pickedDay = ''
      const stage = stageOf(session.baby.birthday, day)
      this.setData({
        needBaby: false,
        baby: session.baby,
        day,
        pretty: prettyDay(day),
        actions: recordActions(stage),
        more: hiddenCareActions(stage)
      })
      return api.getDay({ babyId: session.baby._id, day }).then((data) => {
        this.setData({
          records: (data.records || []).map((item) => Object.assign({
            timeText: timeKey(item.happenedAt),
            icon: iconFor(item.type)
          }, item))
        })
      })
    }).catch((err) => {
      this.setData({ pageError: err.message || '云服务没有连上', ready: true })
    })
  },
  onDate(e) {
    this.pickedDay = e.detail.value
    this.reload()
  },
  onAction(e) {
    openAction(e.currentTarget.dataset.key, this.data.day)
  },
  toggleMore() {
    this.setData({ showMore: true })
  },
  openRecord(e) {
    wx.navigateTo({
      url: '/pages/event-edit/index?type=' + e.currentTarget.dataset.type + '&id=' + e.currentTarget.dataset.id + '&day=' + this.data.day
    })
  },
  goBaby() {
    wx.navigateTo({ url: '/pages/baby-edit/index' })
  }
})
