const pageBehavior = require('../../behaviors/page.js')
const api = require('../../services/api.js')
const session = require('../../services/session.js')
const { templateReady } = require('../../services/subscribe.js')

const ROLES = ['妈妈', '爸爸', '奶奶', '爷爷', '外婆', '外公', '月嫂', '其他']

Page({
  behaviors: [pageBehavior],
  data: {
    baby: null,
    babies: [],
    roles: ROLES,
    roleIndex: 0,
    displayName: '',
    templateHint: templateReady ? '' : ' 微信吃药通知还没配置，小程序里仍然能记每一顿。'
  },
  onShow() {
    this.prepare().then((data) => {
      this.syncTab(3, !!(data.member && data.member.elderMode))
      const roleIndex = Math.max(0, ROLES.indexOf(data.member.roleName))
      this.setData({
        baby: data.baby,
        babies: data.babies || [],
        roleIndex,
        displayName: data.member.displayName || '',
        elder: !!data.member.elderMode
      })
    }).catch((err) => this.fail(err))
  },
  saveMember(extra) {
    const roleName = ROLES[this.data.roleIndex]
    return api.updateMember(Object.assign({
      roleName,
      displayName: this.data.displayName,
      elderMode: this.data.elder
    }, extra)).then((data) => {
      session.apply(data)
      this.setData({ elder: !!data.member.elderMode })
      this.syncTab(3, !!data.member.elderMode)
    }).catch((err) => this.fail(err))
  },
  onRole(e) {
    this.setData({ roleIndex: Number(e.detail.value) })
    this.saveMember()
  },
  onName(e) {
    this.setData({ displayName: e.detail.value })
  },
  onNameBlur() {
    this.saveMember()
  },
  onElder(e) {
    this.setData({ elder: e.detail.value })
    this.saveMember({ elderMode: e.detail.value })
  },
  onSwitch(e) {
    api.switchBaby({ babyId: e.currentTarget.dataset.id }).then((data) => {
      session.apply(data)
      this.setData({ baby: data.baby, babies: data.babies })
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
