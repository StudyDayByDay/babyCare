const pageBehavior = require('../../behaviors/page.js')
const api = require('../../services/api.js')
const { dayKey, stageOf, dayNumber, prettyDay } = require('../../utils/date.js')
const { showEarlyEdu, showNewbornCare } = require('../../utils/stage.js')
const theme = require('../../utils/theme.js')

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
    loading: true,
    pageError: '',
    dirty: false,
    pretty: '',
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
    const day = query.day || dayKey()
    this.setData({ day, pretty: prettyDay(day) })
  },
  onShow() {
    this.reload()
  },
  onUnload() {
    if (this.alertOn && wx.disableAlertBeforeUnload) {
      try { wx.disableAlertBeforeUnload() } catch (e) {}
      this.alertOn = false
    }
  },
  retry() {
    this.setData({ pageError: '', loading: true })
    this.reload()
  },
  reload() {
    if (!this.loaded) this.setData({ loading: true })
    return this.prepare().then((session) => {
      if (!session.baby) {
        wx.navigateBack()
        return null
      }
      this.baby = session.baby
      return this.load()
    }).then(() => {
      this.loaded = true
      this.setData({ loading: false, pageError: '' })
    }).catch((err) => {
      this.loaded = true
      this.setData({ loading: false, pageError: err.message || '云服务没有连上' })
    })
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
  markDirty() {
    if (this.data.dirty) return
    this.setData({ dirty: true })
    if (wx.enableAlertBeforeUnload && !this.alertOn) {
      this.alertOn = true
      try {
        wx.enableAlertBeforeUnload({ message: '还没保存，确定离开？' })
      } catch (e) {}
    }
  },
  clearDirty() {
    if (this.alertOn && wx.disableAlertBeforeUnload) {
      try { wx.disableAlertBeforeUnload() } catch (e) {}
    }
    this.alertOn = false
    this.setData({ dirty: false })
  },
  onDay(e) {
    const day = e.detail.value
    const apply = () => {
      this.setData({ day, pretty: prettyDay(day) })
      this.clearDirty()
      this.load().catch((err) => this.fail(err))
    }
    if (!this.data.dirty) {
      apply()
      return
    }
    wx.showModal({
      title: '切换日期？',
      content: '这一天的改动还没保存，切换后会丢掉。',
      confirmColor: theme.danger,
      success: (res) => {
        if (res.confirm) apply()
      }
    })
  },
  onMood(e) {
    this.setData({ mood: e.currentTarget.dataset.value })
    this.markDirty()
  },
  onSup(e) {
    const supplements = Object.assign({}, this.data.supplements)
    const key = e.currentTarget.dataset.key
    supplements[key] = !supplements[key]
    this.setData({ supplements })
    this.markDirty()
  },
  onCustom(e) {
    const supplements = Object.assign({}, this.data.supplements, { custom: Object.assign({}, this.data.supplements.custom) })
    const key = e.currentTarget.dataset.key
    supplements.custom[key] = !supplements.custom[key]
    this.setData({ supplements })
    this.markDirty()
  },
  onCare(e) {
    const care = Object.assign({}, this.data.care)
    const key = e.currentTarget.dataset.key
    care[key] = !care[key]
    this.setData({ care })
    this.markDirty()
  },
  onEdu(e) {
    const earlyEdu = Object.assign({}, this.data.earlyEdu)
    const key = e.currentTarget.dataset.key
    earlyEdu[key] = !earlyEdu[key]
    this.setData({ earlyEdu })
    this.markDirty()
  },
  onTummy(e) {
    this.setData({ tummyMin: e.detail.value })
    this.markDirty()
  },
  onJaundice(e) {
    this.setData({ jaundice: e.currentTarget.dataset.value })
    this.markDirty()
  },
  onUmbilical(e) {
    this.setData({ umbilical: e.currentTarget.dataset.value })
    this.markDirty()
  },
  onWeather(e) {
    this.setData({ weather: e.detail.value })
    this.markDirty()
  },
  onNote(e) {
    this.setData({ note: e.detail.value })
    this.markDirty()
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
    }).then(() => {
      this.clearDirty()
      this.setData({ saving: false })
      this.ok('已保存')
      this.backAfter(450)
    }).catch((err) => {
      this.setData({ saving: false })
      this.fail(err)
    })
  }
})
