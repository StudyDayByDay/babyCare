const pageBehavior = require('../../behaviors/page.js')
const api = require('../../services/api.js')
const { requestMedSubscribe, templateReady } = require('../../services/subscribe.js')
const { dayKey, addDays, diffDays } = require('../../utils/date.js')

const UNITS = ['颗', '片', '粒', '毫升', '滴', '袋', '支', '克', '勺']
const DEFAULT_TIMES = {
  1: ['08:00'],
  2: ['08:00', '20:00'],
  3: ['08:00', '14:00', '20:00'],
  4: ['08:00', '12:00', '16:00', '20:00'],
  5: ['08:00', '11:00', '14:00', '17:00', '20:00'],
  6: ['07:00', '10:00', '13:00', '16:00', '19:00', '22:00']
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
    endDay: '',
    mealNote: '',
    meals: ['', '饭前', '饭后', '与奶隔开'],
    remind: true,
    saving: false
  },
  onLoad(query) {
    const startDay = dayKey()
    this.editId = query.id || ''
    this.setData({
      id: this.editId,
      startDay,
      endDay: addDays(startDay, 2)
    })
  },
  onShow() {
    this.prepare().then((session) => {
      if (!session.baby) {
        wx.navigateBack()
        return
      }
      this.babyId = session.baby._id
      if (this.editId && !this.loaded) {
        this.loaded = true
        api.getMedication({ babyId: this.babyId, _id: this.editId }).then((med) => this.fill(med)).catch((err) => this.fail(err))
      }
    }).catch((err) => this.fail(err))
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
    })
  },
  onName(e) {
    this.setData({ name: e.detail.value })
  },
  onAmount(e) {
    const doseAmount = e.detail.value
    const slots = this.data.sameDose
      ? this.data.slots.map((slot) => Object.assign({}, slot, { doseAmount }))
      : this.data.slots
    this.setData({ doseAmount, slots })
  },
  onUnit(e) {
    this.setData({ unitIndex: Number(e.detail.value) })
  },
  onFreq(e) {
    this.setData({ frequencyType: e.currentTarget.dataset.value })
  },
  onTimes(e) {
    const timesPerDay = e.detail.value
    const slots = buildSlots(timesPerDay, this.data.doseAmount, this.data.slots)
    this.setData({ timesPerDay, slots })
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
  },
  onSlotAmount(e) {
    const index = Number(e.currentTarget.dataset.index)
    const slots = this.data.slots.map((slot, i) => i === index ? Object.assign({}, slot, { doseAmount: e.detail.value }) : slot)
    this.setData({ slots })
  },
  onInterval(e) {
    this.setData({ intervalHours: e.detail.value })
  },
  onFirstTime(e) {
    this.setData({ firstTime: e.detail.value })
  },
  onStart(e) {
    const startDay = e.detail.value
    this.setData({ startDay, endDay: addDays(startDay, this.data.days - 1) })
  },
  onDays(e) {
    const days = e.detail.value
    this.setData({ days, endDay: addDays(this.data.startDay, days - 1) })
  },
  onMeal(e) {
    this.setData({ mealNote: e.currentTarget.dataset.value })
  },
  onRemind(e) {
    this.setData({ remind: e.detail.value })
  },
  save() {
    if (this.data.saving) return
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
      name: this.data.name,
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
      if (!this.data.remind) return null
      if (!templateReady) this.toast('已保存。打开小程序就能看到每一顿')
      return sub
    }).then(() => wx.navigateBack()).catch((err) => {
      this.setData({ saving: false })
      this.fail(err)
    })
  }
})
