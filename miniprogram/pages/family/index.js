const pageBehavior = require('../../behaviors/page.js')
const api = require('../../services/api.js')
const session = require('../../services/session.js')

Page({
  behaviors: [pageBehavior],
  data: { inviteCode: '', isOwner: false, members: [], code: '' },
  onShow() {
    this.prepare().then((data) => {
      this.setData({
        inviteCode: data.family.inviteCode,
        isOwner: data.family.isOwner
      })
      return api.listMembers()
    }).then((res) => {
      if (res) this.setData({ members: res.list || [] })
    }).catch((err) => this.fail(err))
  },
  copy() {
    wx.setClipboardData({ data: this.data.inviteCode })
  },
  renew() {
    api.createInvite().then((data) => {
      session.apply(data)
      this.setData({ inviteCode: data.family.inviteCode })
    }).catch((err) => this.fail(err))
  },
  onCode(e) {
    this.setData({ code: e.detail.value })
  },
  join() {
    api.joinFamily({ inviteCode: this.data.code }).then((data) => {
      session.apply(data)
      this.toast('已加入')
      wx.navigateBack()
    }).catch((err) => this.fail(err))
  },
  leave() {
    wx.showModal({
      title: '退出这个家庭？',
      content: '退出后就看不到这个宝宝的记录了。',
      confirmColor: '#C4624E',
      success: (res) => {
        if (!res.confirm) return
        api.leaveFamily().then((data) => {
          session.apply(data)
          wx.navigateBack()
        }).catch((err) => this.fail(err))
      }
    })
  },
  remove(e) {
    api.removeMember({ memberId: e.currentTarget.dataset.id }).then(() => api.listMembers()).then((res) => {
      this.setData({ members: res.list || [] })
    }).catch((err) => this.fail(err))
  }
})
