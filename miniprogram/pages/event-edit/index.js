const pageBehavior = require('../../behaviors/page.js')
const api = require('../../services/api.js')
const { dayKey, timeKey, toTs, stageOf, durationText } = require('../../utils/date.js')
const { milestones, iconFor, toneFor } = require('../../utils/stage.js')
const theme = require('../../utils/theme.js')

const TITLES = {
  feed: '记喂奶',
  diaper: '记尿布',
  sleep: '记睡眠',
  temp: '记体温',
  solid: '记用餐',
  milestone: '记里程碑',
  note: '记一笔'
}

const HINTS = {
  feed: '亲喂和瓶喂可以一起记，只填这次发生的。',
  diaper: '选这一片尿布的情况，颜色只在有大便时出现。',
  sleep: '记下起止时间，头朝向可选。',
  temp: '只记测到的数字，不判断正不正常。',
  solid: '记吃了什么、吃得怎么样。',
  milestone: '只是留个纪念，不是发育评估。',
  note: '症状、就医、医生原话都记在这里。'
}

function splitAt(ts) {
  return { day: dayKey(ts), time: timeKey(ts) }
}

Page({
  behaviors: [pageBehavior],
  data: {
    loading: true,
    pageError: '',
    formError: '',
    type: 'feed',
    title: '记一笔',
    typeHint: '',
    icon: 'feed',
    tone: 'feed',
    hint: '',
    recordId: '',
    day: '',
    time: '',
    timePreset: 'now',
    startDay: '',
    startTime: '',
    endDay: '',
    endTime: '',
    sleepDuration: '',
    leftMin: 0,
    rightMin: 0,
    bottleBreastMl: 0,
    formulaMl: 0,
    feedSummary: '',
    spit: '无',
    spits: ['无', '少', '多'],
    pee: true,
    poop: false,
    diaperKind: 'pee',
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
    saving: false,
    theme
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
      typeHint: HINTS[type] || '',
      icon: iconFor(type),
      tone: toneFor(type),
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
    if (!this.loaded) this.setData({ loading: true })
    this.prepare().then((session) => {
      if (!session.baby) {
        wx.navigateBack()
        return null
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
        return api.getRecord({ babyId: this.babyId, _id: this.recordId }).then((rec) => this.fill(rec))
      }
      return null
    }).then(() => {
      this.updateSummary()
      this.loaded = true
      this.setData({ loading: false, pageError: '' })
    }).catch((err) => {
      this.loaded = true
      this.setData({ loading: false, pageError: err.message || '云服务没有连上' })
    })
  },
  retry() {
    this.loaded = false
    this.setData({ pageError: '', loading: true })
    this.onShow()
  },
  fill(rec) {
    const p = rec.payload || {}
    const when = splitAt(rec.happenedAt)
    const patch = { day: when.day, time: when.time, timePreset: 'custom', note: p.note || '' }
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
      const pee = !!p.pee
      const poop = !!p.poop
      Object.assign(patch, {
        pee,
        poop,
        diaperKind: pee && poop ? 'both' : (poop ? 'poop' : 'pee'),
        color: p.color || '黄',
        texture: p.texture || '糊',
        amount: p.amount || '中'
      })
    }
    if (rec.type === 'sleep') {
      const start = splitAt(p.startAt)
      const end = splitAt(p.endAt)
      Object.assign(patch, {
        startDay: start.day,
        startTime: start.time,
        endDay: end.day,
        endTime: end.time,
        direction: p.direction || '仰'
      })
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
  updateSummary() {
    const d = this.data
    let feedSummary = ''
    if (d.type === 'feed') {
      const bits = []
      if (d.leftMin) bits.push('左 ' + d.leftMin + ' 分钟')
      if (d.rightMin) bits.push('右 ' + d.rightMin + ' 分钟')
      if (d.bottleBreastMl) bits.push('瓶喂母乳 ' + d.bottleBreastMl + ' 毫升')
      if (d.formulaMl) bits.push('配方 ' + d.formulaMl + ' 毫升')
      feedSummary = bits.join(' · ')
    }
    let sleepDuration = ''
    if (d.type === 'sleep') {
      const start = toTs(d.startDay, d.startTime)
      let end = toTs(d.endDay, d.endTime)
      if (end <= start) end += 24 * 3600 * 1000
      const min = Math.round((end - start) / 60000)
      sleepDuration = min > 0 ? durationText(min) : ''
    }
    this.setData({ feedSummary, sleepDuration })
  },
  onPick(e) {
    const field = e.currentTarget.dataset.field
    const patch = { formError: '' }
    patch[field] = e.detail.value
    if (field === 'day' || field === 'time') patch.timePreset = 'custom'
    this.setData(patch, () => this.updateSummary())
  },
  onChip(e) {
    const patch = { formError: '' }
    patch[e.currentTarget.dataset.field] = e.currentTarget.dataset.value
    this.setData(patch)
  },
  onInput(e) {
    const patch = { formError: '' }
    patch[e.currentTarget.dataset.field] = e.detail.value
    this.setData(patch)
  },
  onDiaperKind(e) {
    const kind = e.currentTarget.dataset.kind
    this.setData({
      diaperKind: kind,
      pee: kind !== 'poop',
      poop: kind !== 'pee',
      formError: ''
    })
  },
  setAgo(e) {
    const minutes = Number(e.currentTarget.dataset.min) || 0
    const ts = Date.now() - minutes * 60000
    const patch = { day: dayKey(ts), time: timeKey(ts), timePreset: e.currentTarget.dataset.preset, formError: '' }
    if (this.data.type === 'sleep') {
      patch.startDay = patch.day
      patch.startTime = patch.time
    }
    this.setData(patch, () => this.updateSummary())
  },
  setTemp(e) {
    const value = Number(e.currentTarget.dataset.value)
    this.setData({ celsius: value, formError: '' })
  },
  onToggle(e) {
    const field = e.currentTarget.dataset.field
    const patch = { formError: '' }
    patch[field] = !this.data[field]
    this.setData(patch)
  },
  onStep(e) {
    const patch = { formError: '' }
    patch[e.currentTarget.dataset.field] = e.detail.value
    this.setData(patch, () => this.updateSummary())
  },
  validate() {
    const d = this.data
    let error = ''
    if (d.type === 'feed') {
      if (!(d.leftMin > 0 || d.rightMin > 0 || d.bottleBreastMl > 0 || d.formulaMl > 0)) {
        error = '至少填一项：亲喂或瓶喂'
      }
    } else if (d.type === 'diaper') {
      if (!d.pee && !d.poop) error = '选一下小便或大便'
    } else if (d.type === 'sleep') {
      const start = toTs(d.startDay, d.startTime)
      let end = toTs(d.endDay, d.endTime)
      if (end <= start) end += 24 * 3600 * 1000
      const min = (end - start) / 60000
      if (min <= 0) error = '结束时间要晚于开始时间'
      else if (min > 18 * 60) error = '睡这么久？确认一下起止时间'
    } else if (d.type === 'temp') {
      if (!(d.celsius >= 34 && d.celsius <= 42)) error = '体温要在 34 到 42 之间'
    } else if (d.type === 'solid') {
      if (!String(d.solidName || '').trim()) error = '写了吃了什么再保存'
    } else if (d.type === 'milestone') {
      if (!String(d.milestone || '').trim()) error = '选一个或写一个里程碑'
    } else if (d.type === 'note') {
      if (!String(d.noteText || '').trim()) error = '写下这次想记的内容'
    }
    this.setData({ formError: error })
    if (error) wx.pageScrollTo({ scrollTop: 0, duration: 200 })
    return !error
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
    if (!this.validate()) return
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
    }).then(() => {
      this.setData({ saving: false })
      this.ok('已记下')
      this.backAfter(450)
    }).catch((err) => {
      this.setData({ saving: false })
      this.fail(err)
    })
  },
  remove() {
    wx.showModal({
      title: '删除这条记录？',
      content: '删除后当天合计会跟着变。',
      confirmColor: theme.danger,
      success: (res) => {
        if (!res.confirm) return
        api.deleteRecord({ babyId: this.babyId, _id: this.data.recordId }).then(() => {
          this.ok('已删除')
          this.backAfter(450)
        }).catch((err) => this.fail(err))
      }
    })
  }
})
