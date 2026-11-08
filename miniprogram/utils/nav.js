function openAction(key, day) {
  if (key === 'daily') {
    wx.navigateTo({ url: '/pages/daily-edit/index' + (day ? '?day=' + day : '') })
    return
  }
  if (key === 'med') {
    wx.navigateTo({ url: '/pages/med-list/index' })
    return
  }
  wx.navigateTo({ url: '/pages/event-edit/index?type=' + key + (day ? '&day=' + day : '') })
}

function openDay(day) {
  wx.setStorageSync('ledgerDay', day)
  wx.switchTab({ url: '/pages/record/index' })
}

module.exports = { openAction, openDay }
