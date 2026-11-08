const pageBehavior = require('../../behaviors/page.js')
const api = require('../../services/api.js')
const session = require('../../services/session.js')
const { templateReady } = require('../../services/subscribe.js')
const theme = require('../../utils/theme.js')

const ROLES = ['妈妈', '爸爸', '奶奶', '爷爷', '外婆', '外公', '月嫂', '其他']

Page({
  behaviors: [pageBehavior],
  data: {
    loading: true,
    baby: null,
    babies: [],
    nicknameInitial: '宝',
    roles: ROLES,
    roleIndex: 0,
    displayName: '',
    theme,
    templateHint: templateReady ? '' : ' 微信吃药通知还没配置，小程序里仍然能记每一顿。'
  },
  onShow() {
    this.reload()
  },
  retry() {
    this.setData({ pageError: '', loading: true })
    this.reload()
  },
  reload() {
    if (!this.loaded) this.setData({ loading: true })
    return this.prepare().then((data) => {
      this.syncTab(3, !!(data.member && data.member.elderMode))
      const roleIndex = Math.max(0, ROLES.indexOf(data.member.roleName))
      const displayName = data.member.displayName || ''
      this.lastSavedName = displayName
      this.loaded = true
      this.setData({
        baby: data.baby,
        babies: data.babies || [],
        nicknameInitial: data.baby ? (data.baby.nickname || '宝').slice(0, 1) : '宝',
        roleIndex,
        displayName,
        elder: !!data.member.elderMode,
        loading: false,
        pageError: ''
      })
    }).catch((err) => {
      this.loaded = true
      this.setData({ loading: false, pageError: err.message || '云服务没有连上' })
    })
  },
  saveMember(extra) {
    const roleName = ROLES[this.data.roleIndex]
    return api.updateMember(Object.assign({
      roleName,
      displayName: String(this.data.displayName || '').trim(),
      elderMode: this.data.elder
    }, extra)).then((data) => {
      session.apply(data)
      this.setData({ elder: !!data.member.elderMode })
      this.syncTab(3, !!data.member.elderMode)
      return data
    })
  },
  onRole(e) {
    this.setData({ roleIndex: Number(e.detail.value) })
    this.saveMember().then(() => this.ok('已保存')).catch((err) => this.fail(err))
  },
  onName(e) {
    this.setData({ displayName: e.detail.value })
  },
  onNameBlur() {
    const name = String(this.data.displayName || '').trim()
    if (name === this.lastSavedName) return
    this.saveMember().then(() => {
      this.lastSavedName = name
      this.ok('已保存')
    }).catch((err) => this.fail(err))
  },
  onElder(e) {
    const elder = e.detail.value
    const prev = this.data.elder
    this.setData({ elder })
    this.saveMember({ elderMode: elder }).then(() => {
      this.ok('已保存')
    }).catch((err) => {
      this.setData({ elder: prev })
      this.syncTab(3, prev)
      this.fail(err)
    })
  },
  onSwitch(e) {
    api.switchBaby({ babyId: e.currentTarget.dataset.id }).then((data) => {
      session.apply(data)
      this.setData({
        baby: data.baby,
        babies: data.babies,
        nicknameInitial: data.baby ? (data.baby.nickname || '宝').slice(0, 1) : '宝'
      })
      this.ok('已切换')
    }).catch((err) => this.fail(err))
  },
  editBaby() {
    const id = this.data.baby ? this.data.baby._id : ''
    wx.navigateTo({ url: '/pages/baby-edit/index' + (id ? '?id=' + id : '') })
  },
  addBaby() {
    wx.navigateTo({ url: '/pages/baby-edit/index?fresh=1' })
  },
  go(e) {
    wx.navigateTo({ url: e.currentTarget.dataset.url })
  }
})
