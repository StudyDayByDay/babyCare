const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const { handle } = require('./lib/service')

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  try {
    if (event.action === 'extendMeds') {
      const { fillAllActive } = require('./lib/meds')
      const data = await fillAllActive(db, Date.now())
      return { ok: true, data }
    }
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
