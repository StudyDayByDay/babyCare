const api = require('./api.js')

let pending = null

function store() {
  return getApp()
}

function ensure() {
  const app = store()
  if (app.globalData.session) return Promise.resolve(app.globalData.session)
  if (pending) return pending
  pending = api.bootstrap().then((data) => {
    pending = null
    return apply(data)
  }).catch((err) => {
    pending = null
    throw err
  })
  return pending
}

function apply(data) {
  const app = store()
  app.globalData.session = data
  app.globalData.elder = !!(data.member && data.member.elderMode)
  return data
}

function refresh() {
  store().globalData.session = null
  return ensure()
}

module.exports = { ensure, apply, refresh }
