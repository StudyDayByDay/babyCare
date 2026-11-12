async function fetchWhere(db, name, where, max) {
  const out = []
  const cap = max || 2000
  let skip = 0
  while (out.length < cap) {
    const res = await db.collection(name).where(where).skip(skip).limit(100).get()
    out.push.apply(out, res.data)
    if (res.data.length < 100) break
    skip += 100
  }
  return out
}

async function runBatches(items, worker) {
  const size = 20
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(worker))
  }
}

module.exports = { fetchWhere, runBatches }
