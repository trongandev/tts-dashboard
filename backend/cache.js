// Simple in-memory cache with TTL
const map = new Map()

function generateKey(path, params = {}, headers = {}) {
    try {
        // Only include safe header keys (e.g., authorization) to avoid leaking extras
        const relevantHeaders = {}
        if (headers.authorization) relevantHeaders.authorization = headers.authorization
        return `${path}|${JSON.stringify(params)}|${JSON.stringify(relevantHeaders)}`
    } catch (e) {
        return `${path}|${String(params)}|${String(headers)}`
    }
}

function set(key, value, ttlSeconds = 60) {
    const expiresAt = Date.now() + ttlSeconds * 1000
    map.set(key, { value, expiresAt })
}

function get(key) {
    const entry = map.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
        map.delete(key)
        return null
    }
    return entry.value
}

function del(key) {
    map.delete(key)
}

function clearExpired() {
    const now = Date.now()
    for (const [k, v] of map.entries()) {
        if (v.expiresAt <= now) map.delete(k)
    }
}

// optional: periodic cleanup
setInterval(clearExpired, 60 * 60 * 1000) // every hour

module.exports = {
    generateKey,
    set,
    get,
    del,
    clearExpired,
}
