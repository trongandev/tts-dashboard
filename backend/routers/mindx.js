import express from 'express'
import { GET_CLASSES_QUERY, GET_TIMESHEET_QUERY, FIND_INFO_QUERY } from '../queries.js'
import cache from '../cache.js'
import { createClient } from '../graphqlClient.js'
import state from '../state.js'
import catchAsync from '../middlewares/catchAsync.js'
import MindXService from '../services/mindx.service.js'
const router = express.Router()

router.post(
    '/login',
    catchAsync(async (req, res, next) => {
        const { email, password } = req.body
        const result = await MindXService.login(email, password)
        res.json(result)
    }),
)

router.post(
    '/refresh-token',
    catchAsync(async (req, res, next) => {
        const { grant_type, refresh_token } = req.body
        const result = await MindXService.refreshToken(grant_type, refresh_token)
        res.json(result)
    }),
)

router.post('/classes', async (req, res, next) => {
    try {
        const { pageIndex = 0, itemsPerPage = 20, teacherId, search, orderBy = 'createdAt_desc' } = req.body

        const authorization = req.headers.authorization

        // Cache key should include endpoint, params and authorization to avoid leaking data
        const cacheKey = cache.generateKey('/classes', { pageIndex, itemsPerPage, teacherId, search, orderBy }, { authorization })
        const cached = cache.get(cacheKey)
        if (cached) return res.json(cached)

        // Khởi tạo GraphQL client
        const client = createClient(authorization)

        // Gọi GraphQL API
        const data = await client.request(GET_CLASSES_QUERY, {
            pageIndex,
            itemsPerPage,
            teacherId,
            search,
            orderBy,
        })

        // Lưu cache 8 giờ (seconds)
        cache.set(cacheKey, data, 8 * 60 * 60)

        res.json(data)
    } catch (error) {
        console.error('GraphQL Error:', error.message)
        res.status(500).json({ error: error.message })
    }
})

router.post('/timesheet', async (req, res, next) => {
    try {
        let { teacherId, startDate, endDate } = req.body
        const authorization = req.headers.authorization

        if (!authorization) {
            return res.status(401).json({ error: 'Missing Authorization header' })
        }

        if (!startDate) {
            // lấy ra ngày đầu tiên của tháng hiện tại
            const now = new Date()
            startDate = new Date(now.getFullYear(), now.getMonth(), 1).getTime().toString()
        }

        if (!endDate) {
            // lấy ra ngày cuối cùng của tháng hiện tại
            const now = new Date()
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime().toString()
        }

        const payload = { teacherId, startDate, endDate }

        const cacheKey = cache.generateKey('/timesheet', payload, { authorization })
        const cached = cache.get(cacheKey)
        if (cached) return res.json(cached)

        const client = createClient(authorization)
        const data = await client.request(GET_TIMESHEET_QUERY, payload)

        cache.set(cacheKey, data, 8 * 60 * 60)

        res.json(data)
    } catch (error) {
        console.error('GraphQL Error:', error.message)
        res.status(500).json({ error: error.message })
    }
})

router.post('/find-info', async (req, res, next) => {
    try {
        const { payload } = req.body
        const authorization = req.headers.authorization

        if (!authorization) {
            return res.status(401).json({ error: 'Missing Authorization header' })
        }

        if (!payload || !payload.id) {
            return res.status(400).json({ error: 'Missing payload.id' })
        }

        const client = createClient(authorization)
        const data = await client.request(FIND_INFO_QUERY, { payload })

        res.json(data)
    } catch (error) {
        console.error('GraphQL Error:', error.message)
        res.status(500).json({ error: error.message })
    }
})

router.post('/salary/rank', async (req, res, next) => {
    try {
        const { teacherId, fromMonth, fromYear, toMonth, toYear, rankId, updates } = req.body
        const authorization = req.headers.authorization
        if (!authorization) return res.status(401).json({ error: 'Missing Auth' })

        const promises = []

        if (updates && Array.isArray(updates)) {
            // Batch update from an array of { month, year, rankId } (Used for Undo)
            for (const update of updates) {
                const key = `${teacherId}_${update.month}_${update.year}`
                if (state.db) {
                    promises.push(
                        state.db.collection('teacher_ranks').doc(key).set({
                            teacherId,
                            month: update.month,
                            year: update.year,
                            rankId: update.rankId,
                            updatedAt: state.FieldValue.serverTimestamp(),
                        }),
                    )
                } else {
                    state.customRanks.set(key, update.rankId)
                }
            }
        } else {
            // Range update
            let curM = fromMonth
            let curY = fromYear
            while (curY < toYear || (curY === toYear && curM <= toMonth)) {
                const key = `${teacherId}_${curM}_${curY}`
                if (state.db) {
                    promises.push(state.db.collection('teacher_ranks').doc(key).set({ teacherId, month: curM, year: curY, rankId, updatedAt: state.FieldValue.serverTimestamp() }))
                } else {
                    state.customRanks.set(key, rankId)
                }
                curM++
                if (curM > 12) {
                    curM = 1
                    curY++
                }
            }
        }
        await Promise.all(promises)

        // Invalidate all salary caches for this teacher to force refresh
        if (state.db) {
            const snapshot = await state.db.collection('salary_cache').where('teacherId', '==', teacherId).get()
            const batch = state.db.batch()
            snapshot.docs.forEach((doc) => batch.delete(doc.ref))
            await batch.commit()
        } else {
            for (const key of state.salaryCache.keys()) {
                if (key.startsWith(`${teacherId}_`)) {
                    state.salaryCache.delete(key)
                }
            }
        }

        res.json({ success: true, message: 'Rank saved for range' })
    } catch (e) {
        res.status(500).json({ error: e.message })
    }
})

router.post('/salary/calculate', async (req, res, next) => {
    try {
        const { teacherId, period, fromMonth, fromYear, toMonth, toYear, forceRefresh } = req.body
        const authorization = req.headers.authorization
        if (!authorization) return res.status(401).json({ error: 'Missing Auth' })
        let cacheKey = `${teacherId}_${period}`
        if (period === 'month' && fromMonth && fromYear) {
            cacheKey = `${teacherId}_month_${fromMonth}_${fromYear}`
        }
        console.log(cacheKey)
        // 1. Try to get from Cache (Permanent until forceRefresh)
        if (!forceRefresh) {
            if (state.db) {
                const cachedDoc = await state.db.collection('salary_cache').doc(cacheKey).get()
                if (cachedDoc.exists) {
                    const data = cachedDoc.data()
                    console.log('!!![DATA CACHING LOADDED]!!!')
                    return res.json(data.result)
                }
            } else {
                const cached = state.salaryCache.get(cacheKey)
                if (cached) {
                    console.log('!!![NOT DATA CACHING]!!!')

                    return res.json(cached.result)
                }
            }
        }

        // 2. Fetch data from GraphQL
        const now = new Date()
        let startDate, endDate
        if (period === 'month' && fromMonth && fromYear) {
            startDate = new Date(fromYear, fromMonth - 1, 1).getTime().toString()
            endDate = new Date(fromYear, fromMonth, 0, 23, 59, 59, 999).getTime().toString()
        } else if (period === 'month') {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1).getTime().toString()
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime().toString()
        } else {
            startDate = new Date(2020, 0, 1).getTime().toString() // Past arbitrary date
            endDate = new Date(now.getFullYear() + 1, 11, 31, 23, 59, 59, 999).getTime().toString()
        }

        const payload = { teacherId, startDate, endDate }
        const client = createClient(authorization)
        const rawData = await client.request(GET_TIMESHEET_QUERY, payload)

        // 3. Process Data
        let timesheetItems = []
        if (rawData?.findTimesheetByTeacher) timesheetItems = rawData.findTimesheetByTeacher

        let totalSalary = 0
        let totalSessions = timesheetItems.length
        const groups = {}
        const rankCounts = {}

        const RANKS_RATE = {
            T0: 70000,
            T1: 90000,
            T2: 100000,
            T3: 120000,
            T4: 140000,
            T5: 150000,
        }

        const fetchedRanks = {}

        for (const item of timesheetItems) {
            // Validate date
            const timeMs = item.date || item.classSessionAttendance?.startTime
            if (!timeMs) continue

            if (item.classSessionAttendance?.status === 'ABSENT_WITH_NOTICE' || item.status === 'ABSENT_WITH_NOTICE') {
                continue
            }

            const date = new Date(Number(timeMs))

            let groupKey
            let groupLabel

            if (period === 'month') {
                const className = item.classSessionAttendance?.class?.name
                if (className) {
                    groupKey = className
                    groupLabel = className
                } else {
                    groupKey = 'Khác'
                    groupLabel = 'Khác'
                }
            } else {
                groupKey = `${date.getMonth() + 1}_${date.getFullYear()}`
                groupLabel = `Tháng ${date.getMonth() + 1}/${date.getFullYear()}`
            }

            if (!groups[groupKey]) {
                groups[groupKey] = { count: 0, salary: 0, month: date.getMonth() + 1, year: date.getFullYear(), ranks: new Set(), label: groupLabel, subTypes: {} }
            }

            if (groupKey === 'Khác') {
                let typeName = item.officeHour?.type || item.type || 'Khác'
                if (typeof typeName === 'string') {
                    const upperType = typeName.toUpperCase()
                    if (upperType === 'TRIAL') typeName = 'Trải nghiệm'
                    else if (upperType === 'MAKEUP' || upperType === 'MAKE_UP') typeName = 'Dạy bù'
                    else if (upperType === 'TUTORING') typeName = 'Gia sư'
                    else if (upperType === 'OFFICE_HOUR') typeName = 'Office Hour'
                }
                groups[groupKey].subTypes[typeName] = (groups[groupKey].subTypes[typeName] || 0) + 1
            }
            // console.log(period)
            // Get custom rank for this month (cached locally to avoid N+1 queries)
            const rankKey = `${teacherId}_${date.getMonth() + 1}_${date.getFullYear()}`
            if (!fetchedRanks[rankKey]) {
                let customRank = 'T0'
                if (state.db) {
                    const rDoc = await state.db.collection('teacher_ranks').doc(rankKey).get()
                    if (rDoc.exists) customRank = rDoc.data().rankId
                } else {
                    if (state.customRanks.has(rankKey)) customRank = state.customRanks.get(rankKey)
                }
                fetchedRanks[rankKey] = customRank
            }
            const customRank = fetchedRanks[rankKey]

            const rankRate = RANKS_RATE[customRank] || 70000
            let itemSalary = 0
            let hours = 2

            if (item.type === 'ATTENDANCE_CLASS') {
                itemSalary = rankRate * 2
            } else if (item.type === 'OFFICE_HOUR' && item.officeHour) {
                const ohType = item.officeHour.type || ''
                const studentCount = item.officeHour.studentCount || 0

                if (item.officeHour.startTime && item.officeHour.endTime) {
                    const start = Number(item.officeHour.startTime)
                    const end = Number(item.officeHour.endTime)
                    if (!isNaN(start) && !isNaN(end)) {
                        hours = (end - start) / 3600000
                    }
                }

                const typeLower = ohType.toLowerCase()

                if (typeLower === 'ta') {
                    itemSalary = 0.75 * rankRate * hours
                } else if (typeLower === 'makeup' || typeLower === 'dạy bù') {
                    itemSalary = studentCount <= 3 ? 0.75 * rankRate * hours : 1.0 * rankRate * hours
                } else if (typeLower.includes('trial') || typeLower.includes('trải nghiệm')) {
                    if (typeLower.includes('online')) {
                        if (studentCount === 1) itemSalary = 40000
                        else if (studentCount === 2) itemSalary = 60000
                        else if (studentCount >= 3) itemSalary = 80000
                    } else {
                        itemSalary = 80000 + studentCount * 30000
                    }
                } else if (typeLower === 'workshop') {
                    itemSalary = 1.0 * rankRate * hours
                } else if (typeLower === 'event' || typeLower === 'sự kiện') {
                    itemSalary = 1.0 * rankRate * 2
                } else if (typeLower === 'main judge' || typeLower === 'bgk chính') {
                    itemSalary = 1.0 * rankRate * 2
                } else if (typeLower === 'sub judge' || typeLower === 'bgk phụ') {
                    itemSalary = Math.min(1.0 * rankRate * 2, 300000)
                } else if (typeLower === 'lab' || typeLower === 'trực lab') {
                    itemSalary = Math.min(1.0 * rankRate * 2, 200000)
                }
            }

            groups[groupKey].count++
            groups[groupKey].salary += itemSalary
            groups[groupKey].ranks.add(customRank)
            totalSalary += itemSalary

            rankCounts[customRank] = (rankCounts[customRank] || 0) + 1
        }

        const chartData = Object.values(groups).map((g) => {
            let description = ''
            if (g.label === 'Khác' && Object.keys(g.subTypes).length > 0) {
                const subLabels = Object.entries(g.subTypes)
                    .map(([k, v]) => `${k} +${v}`)
                    .join(', ')
                description = subLabels
            }
            return {
                label: g.label,
                description,
                salary: g.salary,
                sessions: g.count,
                rank: Array.from(g.ranks).join(', ') || 'T0',
                month: g.month,
                year: g.year,
            }
        })

        if (period !== 'month') {
            chartData.sort((a, b) => a.year - b.year || a.month - b.month)
        } else {
            chartData.sort((a, b) => b.salary - a.salary)
        }

        let mostUsedRank = 'T0'
        let maxCount = 0
        for (const [r, c] of Object.entries(rankCounts)) {
            if (c > maxCount) {
                maxCount = c
                mostUsedRank = r
            }
        }

        const result = {
            chartData,
            totalSalary,
            totalSessions,
            mostUsedRank,
        }

        // 4. Save to Cache
        if (state.db) {
            await state.db.collection('salary_cache').doc(cacheKey).set({ teacherId, result, calculatedAt: Date.now() })
        } else {
            state.salaryCache.set(cacheKey, { teacherId, result, calculatedAt: Date.now() })
        }

        res.json(result)
    } catch (e) {
        console.error('Salary API Error:', e.message)
        res.status(500).json({ error: e.message })
    }
})

export default router
