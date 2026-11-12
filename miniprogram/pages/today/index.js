const pageBehavior = require('../../behaviors/page.js')
const api = require('../../services/api.js')
const { dayKey, prettyDay, ageText, durationText, stageOf, timeKey, dayNumber } = require('../../utils/date.js')
const { stageLabel, recordActions, iconFor, toneFor } = require('../../utils/stage.js')
const { groupDoses, sinceList } = require('../../utils/view.js')
const { openAction } = require('../../utils/nav.js')
const { describeDaily } = require('./dailyText.js')

Page({
  behaviors: [pageBehavior],
  data: {
    loading: true,
    needBaby: false,
    baby: null,
    nicknameInitial: '宝',
    heroMeta: '',
    pretty: '',
    summary: {},
    sleepText: '0分钟',
    records: [],
    shownRecords: [],
    since: [],
    night: false,
    nextGroup: null,
    taking: false,
    medPercent: 0,
    dailyText: '',
    nums: {
      day: 0,
      feed: 0,
      diaper: 0,
      sleepMin: 0,
      milk: 0,
      breastMl: 0,
      formulaMl: 0,
      breastMin: 0,
      poop: 0,
      medTaken: 0
    },
    animSleepText: '0分钟',
    quick: [
      { key: 'feed', title: '喂奶', hint: '母乳和配方', tone: 'feed', icon: 'feed' },
      { key: 'diaper', title: '尿布', hint: '尿和便', tone: 'diaper', icon: 'diaper' },
      { key: 'sleep', title: '睡眠', hint: '现在记下', tone: 'sleep', icon: 'sleep' },
      { key: 'daily', title: '护理', hint: '补剂和清洁', tone: 'care', icon: 'care' }
    ]
  },
  onShow() {
    this.reload()
  },
  onUnload() {
    if (this.numTimer) {
      clearInterval(this.numTimer)
      this.numTimer = null
    }
  },
  onPullDownRefresh() {
    this.reload().finally(() => wx.stopPullDownRefresh())
  },
  retry() {
    const session = require('../../services/session.js')
    this.setData({ pageError: '', loading: true })
    session.refresh().then(() => this.reload()).catch((err) => {
      this.setData({ loading: false })
      this.fail(err)
    })
  },
  reload() {
    if (!this.loaded) this.setData({ loading: true })
    return this.prepare().then((session) => {
      this.syncTab(0, !!(session.member && session.member.elderMode))
      if (!session.baby) {
        this.loaded = true
        this.setData({ needBaby: true, baby: null, loading: false, pageError: '' })
        return null
      }
      if (this.lastBabyId !== session.baby._id) {
        this.lastBabyId = session.baby._id
        this.numsSig = ''
      }
      const today = dayKey()
      const stage = stageOf(session.baby.birthday, today)
      const age = ageText(session.baby.birthday, today)
      const stageText = stageLabel(stage)
      const hour = new Date(Date.now() + 8 * 3600 * 1000).getUTCHours()
      this.setData({
        needBaby: false,
        pageError: '',
        baby: session.baby,
        nicknameInitial: (session.baby.nickname || '宝').slice(0, 1),
        heroMeta: age.indexOf('第') === 0 ? stageText : age + ' · ' + stageText,
        pretty: prettyDay(today),
        quick: recordActions(stage).slice(0, 4),
        night: hour >= 21 || hour < 6
      })
      return this.load(session.baby._id, today)
    }).then(() => {
      this.loaded = true
      this.setData({ loading: false })
    }).catch((err) => {
      this.loaded = true
      this.setData({ loading: false, pageError: err.message || '云服务没有连上' })
    })
  },
  load(babyId, day) {
    return api.getDay({ babyId, day }).then((data) => {
      const grouped = groupDoses(data.doses)
      const records = (data.records || []).map((item) => Object.assign({
        timeText: timeKey(item.happenedAt),
        icon: iconFor(item.type),
        tone: toneFor(item.type)
      }, item))
      const total = Number(data.summary.medTotal) || 0
      const taken = Number(data.summary.medTaken) || 0
      const formulaMl = Number(data.summary.formulaMl) || 0
      const breastMl = Number(data.summary.bottleBreastMl) || 0
      this.setData({
        summary: data.summary,
        sleepText: durationText(data.summary.sleepMin),
        records,
        shownRecords: records.slice(-5).reverse(),
        since: sinceList(data.records, Date.now()),
        nextGroup: grouped.nextGroup,
        medPercent: total > 0 ? Math.round(taken / total * 100) : 0,
        dailyText: describeDaily(data.daily),
        pageError: ''
      })
      this.animateNums({
        day: Math.max(0, dayNumber(this.data.baby.birthday, day)),
        feed: Number(data.summary.feedCount) || 0,
        diaper: Number(data.summary.diaperCount) || 0,
        sleepMin: Number(data.summary.sleepMin) || 0,
        milk: formulaMl + breastMl,
        breastMl,
        formulaMl,
        breastMin: Number(data.summary.breastMin) || 0,
        poop: Number(data.summary.poopCount) || 0,
        medTaken: taken
      })
    })
  },
  animateNums(target) {
    const sig = [
      target.day, target.feed, target.diaper, target.sleepMin,
      target.milk, target.breastMl, target.formulaMl, target.breastMin, target.poop, target.medTaken
    ].join('|')
    if (sig === this.numsSig) return
    this.numsSig = sig
    if (this.numTimer) clearInterval(this.numTimer)
    const from = Object.assign({}, this.data.nums)
    const keys = ['day', 'feed', 'diaper', 'sleepMin', 'milk', 'breastMl', 'formulaMl', 'breastMin', 'poop', 'medTaken']
    const start = Date.now()
    const duration = 620
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration)
      const e = 1 - Math.pow(1 - t, 3)
      const patch = {}
      keys.forEach((key) => {
        patch['nums.' + key] = Math.round(from[key] + (target[key] - from[key]) * e)
      })
      patch.animSleepText = durationText(Math.round(from.sleepMin + (target.sleepMin - from.sleepMin) * e))
      this.setData(patch)
      if (t >= 1) {
        clearInterval(this.numTimer)
        this.numTimer = null
      }
    }
    this.numTimer = setInterval(tick, 30)
    tick()
  },
  goBaby() {
    wx.navigateTo({ url: '/pages/baby-edit/index' })
  },
  goRecord() {
    wx.switchTab({ url: '/pages/record/index' })
  },
  goStats() {
    wx.switchTab({ url: '/pages/stats/index' })
  },
  onAction(e) {
    openAction(e.currentTarget.dataset.key, dayKey())
  },
  openRecord(e) {
    wx.navigateTo({
      url: '/pages/event-edit/index?type=' + e.currentTarget.dataset.type + '&id=' + e.currentTarget.dataset.id
    })
  },
  takeNext() {
    const group = this.data.nextGroup
    const baby = this.data.baby
    if (!group || !baby || this.data.taking) return
    const pending = group.items.filter((item) => item.status === 'pending')
    if (!pending.length) return
    this.setData({ taking: true })
    let chain = Promise.resolve()
    pending.forEach((item) => {
      chain = chain.then(() => api.markDose({ babyId: baby._id, _id: item._id, status: 'taken', when: 'now' }))
    })
    chain.then(() => this.load(baby._id, dayKey())).then(() => {
      this.setData({ taking: false })
      this.ok('已记下')
    }).catch((err) => {
      this.setData({ taking: false })
      this.fail(err)
    })
  }
})
