const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const { handle } = require('./lib/service')

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  try {
    const data = await handle(event.action, event.data || {}, {
      db,
      _: db.command,
      cloud,
      openid: wxContext.OPENID
    })
    return { ok: true, data }
  } catch (err) {
    console.error(err)
    return {
      ok: false,
      code: err.code || 'ERROR',
      message: err.message || '处理失败'
    }
  }
}
