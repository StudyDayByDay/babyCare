const pageBehavior = require('../../behaviors/page.js')
const api = require('../../services/api.js')
const { dayKey, stageOf, dayNumber } = require('../../utils/date.js')
const { showEarlyEdu, showNewbornCare } = require('../../utils/stage.js')

function emptySheet() {
  return {
    mood: '',
    weather: '',
    note: '',
    supplements: { vd: false, ad: false, custom: {} },
    care: { face: false, nose: false, hands: false, nails: false, bath: false, moisture: false },
    earlyEdu: { visual: false, auditory: false, gross: false, fine: false },
    jaundice: '',
    umbilical: '',
    tummyMin: 0
  }
}

Page({
  behaviors: [pageBehavior],
  data: Object.assign({
    day: '',
    saving: false,
    showEdu: true,
    showTummy: true,
    showNewborn: true,
    customNames: [],
    moods: ['好', '一般', '较差'],
    careItems: [
      { key: 'face', label: '洗脸' },
      { key: 'nose', label: '鼻腔' },
      { key: 'hands', label: '洗手' },
      { key: 'nails', label: '剪指甲' },
      { key: 'bath', label: '洗澡' },
      { key: 'moisture', label: '保湿' }
    ],
    eduItems: [
      { key: 'visual', label: '视觉' },
      { key: 'auditory', label: '听觉' },
      { key: 'gross', label: '大动作' },
      { key: 'fine', label: '精细动作' }
    ],
    jaundiceOptions: ['无', '轻', '明显'],
    umbilicalOptions: ['干燥', '渗出', '脱落']
  }, emptySheet()),
  onLoad(query) {
    this.setData({ day: query.day || dayKey() })
  },
  onShow() {
    this.prepare().then((session) => {
      if (!session.baby) {
        wx.navigateBack()
        return
      }
      this.baby = session.baby
      this.load()
    }).catch((err) => this.fail(err))
  },
  load() {
    const day = this.data.day
    const stage = stageOf(this.baby.birthday, day)
    const dayNo = dayNumber(this.baby.birthday, day)
    return api.getDay({ babyId: this.baby._id, day }).then((data) => {
      const sheet = data.daily || emptySheet()
      const custom = Object.assign({}, (sheet.supplements && sheet.supplements.custom) || {})
      this.setData({
        showEdu: showEarlyEdu(stage),
        showTummy: stage === 'newborn' || stage === 'infant',
        showNewborn: showNewbornCare(dayNo),
        customNames: this.baby.customSupplements || [],
        mood: sheet.mood || '',
        weather: sheet.weather || '',
        note: sheet.note || '',
        supplements: {
          vd: !!(sheet.supplements && sheet.supplements.vd),
          ad: !!(sheet.supplements && sheet.supplements.ad),
          custom
        },
        care: Object.assign(emptySheet().care, sheet.care || {}),
        earlyEdu: Object.assign(emptySheet().earlyEdu, sheet.earlyEdu || {}),
        jaundice: sheet.jaundice || '',
        umbilical: sheet.umbilical || '',
        tummyMin: sheet.tummyMin || 0
      })
    })
  },
  onDay(e) {
    this.setData({ day: e.detail.value })
    this.load().catch((err) => this.fail(err))
  },
  onMood(e) {
    this.setData({ mood: e.currentTarget.dataset.value })
  },
  onSup(e) {
    const supplements = Object.assign({}, this.data.supplements)
    const key = e.currentTarget.dataset.key
    supplements[key] = !supplements[key]
    this.setData({ supplements })
  },
  onCustom(e) {
    const supplements = Object.assign({}, this.data.supplements, { custom: Object.assign({}, this.data.supplements.custom) })
    const key = e.currentTarget.dataset.key
    supplements.custom[key] = !supplements.custom[key]
    this.setData({ supplements })
  },
  onCare(e) {
    const care = Object.assign({}, this.data.care)
    const key = e.currentTarget.dataset.key
    care[key] = !care[key]
    this.setData({ care })
  },
  onEdu(e) {
    const earlyEdu = Object.assign({}, this.data.earlyEdu)
    const key = e.currentTarget.dataset.key
    earlyEdu[key] = !earlyEdu[key]
    this.setData({ earlyEdu })
  },
  onTummy(e) {
    this.setData({ tummyMin: e.detail.value })
  },
  onJaundice(e) {
    this.setData({ jaundice: e.currentTarget.dataset.value })
  },
  onUmbilical(e) {
    this.setData({ umbilical: e.currentTarget.dataset.value })
  },
  onWeather(e) {
    this.setData({ weather: e.detail.value })
  },
  onNote(e) {
    this.setData({ note: e.detail.value })
  },
  save() {
    if (this.data.saving) return
    this.setData({ saving: true })
    api.saveDaily({
      babyId: this.baby._id,
      day: this.data.day,
      sheet: {
        mood: this.data.mood,
        weather: this.data.weather,
        note: this.data.note,
        supplements: this.data.supplements,
        care: this.data.care,
        earlyEdu: this.data.earlyEdu,
        jaundice: this.data.jaundice,
        umbilical: this.data.umbilical,
        tummyMin: this.data.tummyMin
      }
    }).then(() => wx.navigateBack()).catch((err) => {
      this.setData({ saving: false })
      this.fail(err)
    })
  }
})
