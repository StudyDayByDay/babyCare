const pageBehavior = require('../../behaviors/page.js')
const api = require('../../services/api.js')
const { requestMedSubscribe, templateReady } = require('../../services/subscribe.js')
const { dayKey, addDays, diffDays, prettyDay } = require('../../utils/date.js')
const theme = require('../../utils/theme.js')

const UNITS = ['颗', '片', '粒', '毫升', '滴', '袋', '支', '克', '勺']
const DEFAULT_TIMES = {
  1: ['08:00'],
  2: ['08:00', '20:00'],
  3: ['08:00', '14:00', '20:00'],
  4: ['08:00', '12:00', '16:00', '20:00'],
  5: ['08:00', '11:00', '14:00', '17:00', '20:00'],
  6: ['07:00', '10:00', '13:00', '16:00', '19:00', '22:00']
}
const STEP_TITLES = { 1: '药品和剂量', 2: '怎么吃', 3: '吃多久' }
const STEP_HINTS = {
  1: '先写药盒上的名字和一次的量。',
  2: '按医嘱设置每一顿的时间和数量。',
  3: '确认开始日和天数，到点会提醒。'
}

function buildSlots(count, amount, prev) {
  const times = DEFAULT_TIMES[count] || DEFAULT_TIMES[3]
  return times.map((time, index) => ({
    time: prev && prev[index] ? prev[index].time : time,
    doseAmount: amount
  }))
}

Page({
  behaviors: [pageBehavior],
  data: {
    loading: true,
    pageError: '',
    step: 1,
    stepTitle: STEP_TITLES[1],
    stepHint: STEP_HINTS[1],
    stepPercent: 33,
    errors: {},
    formError: '',
    summaryText: '',
    id: '',
    name: '',
    doseAmount: 1,
    units: UNITS,
    unitIndex: 0,
    frequencyType: 'timesPerDay',
    timesPerDay: 3,
    intervalHours: 8,
    firstTime: '08:00',
    sameDose: true,
    slots: buildSlots(3, 1),
    startDay: '',
    days: 3,
    spans: [
      { days: 7, label: '一周' },
      { days: 30, label: '一月' },
      { days: 90, label: '3 个月' },
      { days: 180, label: '半年' },
      { days: 365, label: '一年' }
    ],
    endDay: '',
    mealNote: '',
    meals: ['', '饭前', '饭后', '与奶隔开'],
    remind: true,
    saving: false,
    theme
  },
  onLoad(query) {
    const startDay = dayKey()
    this.editId = query.id || ''
    this.setData({
      id: this.editId,
      startDay,
      endDay: addDays(startDay, 2)
    })
    wx.setNavigationBarTitle({ title: this.editId ? '修改用药' : '添加用药' })
  },
  onShow() {
    if (!this.loadedOnce) this.setData({ loading: true })
    this.prepare().then((session) => {
      if (!session.baby) {
        wx.navigateBack()
        return null
      }
      this.babyId = session.baby._id
      if (this.editId && !this.loadedRecord) {
        this.loadedRecord = true
        return api.getMedication({ babyId: this.babyId, _id: this.editId }).then((med) => this.fill(med))
      }
      return null
    }).then(() => {
      this.loadedOnce = true
      this.setData({
        loading: false,
        pageError: '',
        stepTitle: STEP_TITLES[this.data.step],
        stepHint: STEP_HINTS[this.data.step],
        stepPercent: Math.round(this.data.step / 3 * 100)
      })
    }).catch((err) => {
      this.loadedOnce = true
      this.setData({ loading: false, pageError: err.message || '云服务没有连上' })
    })
  },
  retry() {
    this.loadedRecord = false
    this.setData({ pageError: '', loading: true })
    this.onShow()
  },
  fill(med) {
    const unitIndex = Math.max(0, UNITS.indexOf(med.doseUnit))
    const slots = (med.slots && med.slots.length ? med.slots : buildSlots(med.timesPerDay || 3, med.doseAmount)).map((slot) => ({
      time: slot.time,
      doseAmount: slot.doseAmount
    }))
    const same = slots.every((slot) => Number(slot.doseAmount) === Number(med.doseAmount))
    const startDay = med.startDay
    const days = med.days || diffDays(med.startDay, med.endDay)
    this.setData({
      name: med.name,
      doseAmount: med.doseAmount,
      unitIndex,
      frequencyType: med.frequencyType,
      timesPerDay: slots.length || med.timesPerDay,
      intervalHours: med.intervalHours || 8,
      firstTime: slots[0] ? slots[0].time : '08:00',
      sameDose: same,
      slots,
      startDay,
      days,
      endDay: addDays(startDay, days - 1),
      mealNote: med.mealNote || '',
      remind: med.remind !== false
    }, () => this.updateSummary())
  },
  stepPatch(step) {
    return {
      step,
      stepTitle: STEP_TITLES[step],
      stepHint: STEP_HINTS[step],
      stepPercent: Math.round(step / 3 * 100),
      formError: '',
      errors: {}
    }
  },
  next() {
    if (this.data.step === 1 && !this.validateStep1()) return
    if (this.data.step === 2 && !this.validateStep2()) return
    if (this.data.step >= 3) return
    const step = this.data.step + 1
    this.setData(this.stepPatch(step), () => {
      if (step === 3) this.updateSummary()
    })
    wx.pageScrollTo({ scrollTop: 0, duration: 150 })
  },
  prev() {
    if (this.data.step <= 1) return
    this.setData(this.stepPatch(this.data.step - 1))
    wx.pageScrollTo({ scrollTop: 0, duration: 150 })
  },
  validateStep1() {
    const name = String(this.data.name || '').trim()
    if (!name) {
      this.setData({ errors: { name: '写一下药名' }, formError: '写一下药名' })
      return false
    }
    if (name.length > 40) {
      this.setData({ errors: { name: '药名最多 40 个字' }, formError: '药名最多 40 个字' })
      return false
    }
    if (!(Number(this.data.doseAmount) > 0)) {
      this.setData({ errors: {}, formError: '一次的量要大于 0' })
      return false
    }
    this.setData({ errors: {}, formError: '' })
    return true
  },
  validateStep2() {
    if (this.data.frequencyType === 'timesPerDay') {
      const times = this.data.slots.map((slot) => slot.time)
      if (times.some((time) => !time)) {
        this.setData({ formError: '每一顿都要选时间' })
        return false
      }
      if (new Set(times).size !== times.length) {
        this.setData({ formError: '有两顿时间重复了' })
        return false
      }
    }
    if (this.data.frequencyType === 'intervalHours') {
      if (!(Number(this.data.intervalHours) > 0)) {
        this.setData({ formError: '间隔小时数要大于 0' })
        return false
      }
      if (!this.data.firstTime) {
        this.setData({ formError: '选一下第一顿时间' })
        return false
      }
    }
    this.setData({ formError: '' })
    return true
  },
  validateStep3() {
    if (!this.data.startDay) {
      this.setData({ formError: '选一下开始日期' })
      return false
    }
    const days = Number(this.data.days)
    if (!(days > 0)) {
      this.setData({ formError: '天数要大于 0' })
      return false
    }
    if (days > 366) {
      this.setData({ formError: '最长可以记 366 天' })
      return false
    }
    let count = 0
    if (this.data.frequencyType === 'timesPerDay') {
      count = days * Math.max(1, (this.data.slots && this.data.slots.length) || this.data.timesPerDay || 1)
    } else if (this.data.frequencyType === 'intervalHours') {
      count = Math.ceil(days * 24 / (Number(this.data.intervalHours) || 24))
    }
    if (count > 800) {
      this.setData({ formError: '这一程超过 800 顿。一天一次可以记满一年' })
      return false
    }
    this.setData({ formError: '' })
    return true
  },
  updateSummary() {
    const d = this.data
    const unit = UNITS[d.unitIndex] || ''
    let freq = '按需'
    let timeText = ''
    if (d.frequencyType === 'timesPerDay') {
      freq = '一天 ' + d.timesPerDay + ' 次'
      timeText = '，时间 ' + d.slots.map((slot) => slot.time).join(' / ')
    } else if (d.frequencyType === 'intervalHours') {
      freq = '每隔 ' + d.intervalHours + ' 小时'
      timeText = '，第一顿 ' + d.firstTime
    }
    const spanText = d.frequencyType === 'asNeeded'
      ? ''
      : '，从 ' + prettyDay(d.startDay) + ' 吃 ' + d.days + ' 天'
    this.setData({
      summaryText: freq + '，一次 ' + d.doseAmount + ' ' + unit + timeText + spanText
    })
  },
  clearError() {
    if (this.data.formError || Object.keys(this.data.errors || {}).length) {
      this.setData({ formError: '', errors: {} })
    }
  },
  onName(e) {
    this.setData({ name: e.detail.value })
    this.clearError()
  },
  onAmount(e) {
    const doseAmount = e.detail.value
    const slots = this.data.sameDose
      ? this.data.slots.map((slot) => Object.assign({}, slot, { doseAmount }))
      : this.data.slots
    this.setData({ doseAmount, slots })
    this.clearError()
  },
  onUnit(e) {
    this.setData({ unitIndex: Number(e.detail.value) })
    this.updateSummary()
  },
  onFreq(e) {
    this.setData({ frequencyType: e.currentTarget.dataset.value })
    this.clearError()
    this.updateSummary()
  },
  onTimes(e) {
    const timesPerDay = e.detail.value
    const slots = buildSlots(timesPerDay, this.data.doseAmount, this.data.slots)
    this.setData({ timesPerDay, slots })
    this.clearError()
    this.updateSummary()
  },
  onSame(e) {
    const sameDose = e.detail.value
    const slots = sameDose
      ? this.data.slots.map((slot) => Object.assign({}, slot, { doseAmount: this.data.doseAmount }))
      : this.data.slots
    this.setData({ sameDose, slots })
  },
  onSlotTime(e) {
    const index = Number(e.currentTarget.dataset.index)
    const slots = this.data.slots.map((slot, i) => i === index ? Object.assign({}, slot, { time: e.detail.value }) : slot)
    this.setData({ slots })
    this.clearError()
    this.updateSummary()
  },
  onSlotAmount(e) {
    const index = Number(e.currentTarget.dataset.index)
    const slots = this.data.slots.map((slot, i) => i === index ? Object.assign({}, slot, { doseAmount: e.detail.value }) : slot)
    this.setData({ slots })
  },
  onInterval(e) {
    this.setData({ intervalHours: e.detail.value })
    this.clearError()
    this.updateSummary()
  },
  onFirstTime(e) {
    this.setData({ firstTime: e.detail.value })
    this.clearError()
    this.updateSummary()
  },
  onStart(e) {
    const startDay = e.detail.value
    this.setData({ startDay, endDay: addDays(startDay, this.data.days - 1) })
    this.clearError()
    this.updateSummary()
  },
  onDays(e) {
    const days = e.detail.value
    this.setData({ days, endDay: addDays(this.data.startDay, days - 1) })
    this.clearError()
    this.updateSummary()
  },
  setDays(e) {
    const days = Number(e.currentTarget.dataset.days)
    this.setData({ days, endDay: addDays(this.data.startDay, days - 1) })
    this.clearError()
    this.updateSummary()
  },
  onMeal(e) {
    this.setData({ mealNote: e.currentTarget.dataset.value })
  },
  onRemind(e) {
    this.setData({ remind: e.detail.value })
  },
  save() {
    if (this.data.saving) return
    if (!this.validateStep1() || !this.validateStep2() || !this.validateStep3()) return
    const sub = this.data.remind ? requestMedSubscribe() : null
    const unit = UNITS[this.data.unitIndex]
    const slots = this.data.frequencyType === 'intervalHours'
      ? [{ time: this.data.firstTime, doseAmount: this.data.doseAmount, doseUnit: unit }]
      : this.data.slots.map((slot) => ({
        time: slot.time,
        doseAmount: this.data.sameDose ? this.data.doseAmount : slot.doseAmount,
        doseUnit: unit
      }))
    this.setData({ saving: true })
    api.saveMedication({
      _id: this.data.id,
      babyId: this.babyId,
      name: String(this.data.name || '').trim(),
      doseAmount: this.data.doseAmount,
      doseUnit: unit,
      frequencyType: this.data.frequencyType,
      timesPerDay: this.data.timesPerDay,
      intervalHours: this.data.intervalHours,
      slots,
      startDay: this.data.startDay,
      days: this.data.frequencyType === 'asNeeded' ? 1 : this.data.days,
      mealNote: this.data.mealNote,
      remind: this.data.remind
    }).then(() => {
      if (this.data.remind && sub) return sub.catch(() => null)
      return null
    }).then(() => {
      this.setData({ saving: false })
      this.ok('已保存')
      this.backAfter(450)
    }).catch((err) => {
      this.setData({ saving: false })
      this.fail(err)
    })
  }
})
