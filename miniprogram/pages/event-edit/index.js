const pageBehavior = require('../../behaviors/page.js')
const api = require('../../services/api.js')
const { dayKey, timeKey, toTs, stageOf } = require('../../utils/date.js')
const { milestones } = require('../../utils/stage.js')

const TITLES = {
  feed: '记喂奶',
  diaper: '记尿布',
  sleep: '记睡眠',
  temp: '记体温',
  solid: '记用餐',
  milestone: '记里程碑',
  note: '记一笔'
}

function splitAt(ts) {
  return { day: dayKey(ts), time: timeKey(ts) }
}

Page({
  behaviors: [pageBehavior],
  data: {
    type: 'feed',
    title: '记一笔',
    hint: '',
    recordId: '',
    day: '',
    time: '',
    startDay: '',
    startTime: '',
    endDay: '',
    endTime: '',
    sleepHint: '结束早于开始时，按第二天计算。',
    leftMin: 0,
    rightMin: 0,
    bottleBreastMl: 0,
    formulaMl: 0,
    spit: '无',
    spits: ['无', '少', '多'],
    pee: true,
    poop: false,
    color: '黄',
    colors: [
      { value: '胎便', tone: 'meconium' },
      { value: '黄', tone: 'yellow' },
      { value: '绿', tone: 'green' },
      { value: '棕', tone: 'brown' },
      { value: '白陶土', tone: 'clay' },
      { value: '血丝', tone: 'blood' }
    ],
    texture: '糊',
    textures: ['糊', '稀', '干', '黏液', '颗粒'],
    amount: '中',
    amounts: ['少', '中', '多'],
    direction: '仰',
    directions: ['左', '右', '仰'],
    celsius: 36.5,
    solidName: '',
    foodTexture: '泥',
    foodTextures: ['泥', '碎末', '手指食物', '正餐'],
    amountText: '',
    isNew: false,
    reaction: '一般',
    reactions: ['爱吃', '一般', '拒', '未填'],
    presets: [],
    milestone: '',
    category: '生病',
    categories: ['生病', '就医', '其他'],
    noteText: '',
    note: '',
    saving: false
  },
  onLoad(query) {
    const type = query.type || 'feed'
    const now = Date.now()
    const later = now + 60 * 60 * 1000
    const start = splitAt(now)
    const end = splitAt(later)
    this.recordId = query.id || ''
    this.setData({
      type,
      title: TITLES[type] || '记一笔',
      recordId: this.recordId,
      day: query.day || start.day,
      time: start.time,
      startDay: start.day,
      startTime: start.time,
      endDay: end.day,
      endTime: end.time,
      hint: type === 'milestone' ? '只是留个纪念，不是发育评估。' : ''
    })
    wx.setNavigationBarTitle({ title: TITLES[type] || '记一笔' })
  },
  onShow() {
    this.prepare().then((session) => {
      if (!session.baby) {
        wx.navigateBack()
        return
      }
      this.babyId = session.baby._id
      const stage = stageOf(session.baby.birthday, this.data.day || dayKey())
      const patch = { presets: milestones(stage) }
      if (this.data.type === 'solid' && (stage === 'toddler' || stage === 'preschool')) {
        patch.title = '记用餐'
        patch.foodTexture = this.data.foodTexture || '正餐'
      }
      this.setData(patch)
      if (this.recordId && !this.loaded) {
        this.loaded = true
        api.getRecord({ babyId: this.babyId, _id: this.recordId }).then((rec) => this.fill(rec)).catch((err) => this.fail(err))
      }
    }).catch((err) => this.fail(err))
  },
  fill(rec) {
    const p = rec.payload || {}
    const when = splitAt(rec.happenedAt)
    const patch = { day: when.day, time: when.time, note: p.note || '' }
    if (rec.type === 'feed') {
      Object.assign(patch, {
        leftMin: p.leftMin || 0,
        rightMin: p.rightMin || 0,
        bottleBreastMl: p.bottleBreastMl || 0,
        formulaMl: p.formulaMl || 0,
        spit: p.spit || '无'
      })
    }
    if (rec.type === 'diaper') {
      Object.assign(patch, {
        pee: !!p.pee,
        poop: !!p.poop,
        color: p.color || '黄',
        texture: p.texture || '糊',
        amount: p.amount || '中'
      })
    }
    if (rec.type === 'sleep') {
      const start = splitAt(p.startAt)
      const end = splitAt(p.endAt)
      Object.assign(patch, { startDay: start.day, startTime: start.time, endDay: end.day, endTime: end.time, direction: p.direction || '仰' })
    }
    if (rec.type === 'temp') patch.celsius = p.celsius || 36.5
    if (rec.type === 'solid') {
      Object.assign(patch, {
        solidName: p.name || '',
        foodTexture: p.texture || '泥',
        amountText: p.amountText || '',
        isNew: !!p.isNew,
        reaction: p.reaction || '未填'
      })
    }
    if (rec.type === 'milestone') patch.milestone = p.name || ''
    if (rec.type === 'note') {
      patch.category = p.category || '其他'
      patch.noteText = p.text || ''
    }
    this.setData(patch)
  },
  onPick(e) {
    const patch = {}
    patch[e.currentTarget.dataset.field] = e.detail.value
    this.setData(patch)
  },
  onChip(e) {
    const patch = {}
    patch[e.currentTarget.dataset.field] = e.currentTarget.dataset.value
    this.setData(patch)
  },
  onInput(e) {
    const patch = {}
    patch[e.currentTarget.dataset.field] = e.detail.value
    this.setData(patch)
  },
  onToggle(e) {
    const field = e.currentTarget.dataset.field
    const patch = {}
    patch[field] = !this.data[field]
    this.setData(patch)
  },
  onStep(e) {
    const patch = {}
    patch[e.currentTarget.dataset.field] = e.detail.value
    this.setData(patch)
  },
  payload() {
    const d = this.data
    if (d.type === 'feed') {
      return { leftMin: d.leftMin, rightMin: d.rightMin, bottleBreastMl: d.bottleBreastMl, formulaMl: d.formulaMl, spit: d.spit, note: d.note }
    }
    if (d.type === 'diaper') {
      return { pee: d.pee, poop: d.poop, color: d.color, texture: d.texture, amount: d.amount, note: d.note }
    }
    if (d.type === 'sleep') {
      return { startAt: toTs(d.startDay, d.startTime), endAt: toTs(d.endDay, d.endTime), direction: d.direction, note: d.note }
    }
    if (d.type === 'temp') return { celsius: d.celsius }
    if (d.type === 'solid') {
      return { name: d.solidName, texture: d.foodTexture, amountText: d.amountText, isNew: d.isNew, reaction: d.reaction, note: d.note }
    }
    if (d.type === 'milestone') return { name: d.milestone }
    return { category: d.category, text: d.noteText }
  },
  save() {
    if (this.data.saving) return
    const happenedAt = this.data.type === 'sleep'
      ? toTs(this.data.startDay, this.data.startTime)
      : toTs(this.data.day, this.data.time)
    this.setData({ saving: true })
    api.saveRecord({
      _id: this.data.recordId,
      babyId: this.babyId,
      type: this.data.type,
      happenedAt,
      payload: this.payload()
    }).then(() => wx.navigateBack()).catch((err) => {
      this.setData({ saving: false })
      this.fail(err)
    })
  },
  remove() {
    wx.showModal({
      title: '删除这条记录？',
      content: '删除后当天合计会跟着变。',
      confirmColor: '#C4624E',
      success: (res) => {
        if (!res.confirm) return
        api.deleteRecord({ babyId: this.babyId, _id: this.data.recordId }).then(() => wx.navigateBack()).catch((err) => this.fail(err))
      }
    })
  }
})
