import express from 'express'
import fs from 'fs'
import cron from 'node-cron'
import { ThreadType, Zalo } from 'zca-js'
import { FIND_INFO_QUERY, GET_CLASSES_QUERY, GET_CLASSES_QUERY_FOR_TE, GET_TIMESHEET_QUERY } from '../queries.js'
import { createClient } from '../graphqlClient.js'
import MindXService from '../services/mindx.service.js'
import state from '../state.js'

const router = express.Router()

const DEFAULT_RANK = 'T3'
const SALARY_CACHE_TTL = 8 * 60 * 60 * 1000
const LMS_CLASSES_PAGE_SIZE = 20
const LMS_NOTIFICATION_TIMEZONE = 'Asia/Bangkok'
const LMS_NOTIFICATION_COLLECTION = 'chatbot_lms_notifications'
const LMSTA_CLASSES_PAGE_SIZE = 80
const LMSTA_CENTRE_ID = '63f46f0489ef5647c31939d3'
const LMSTA_CENTRE_NAME = 'Đồng Nai - 253 Phạm Văn Thuận'
const LMSTA_AUTHORIZED_EMAILS = new Set(['vuta@mindx.com.vn', 'troandev@mindx.net.vn'])
const LMSTA_NOTIFICATION_COLLECTION = 'chatbot_lmsta_notifications'
const RANKS_RATE = {
    T0: 70000,
    T1: 90000,
    T2: 100000,
    T3: 120000,
    T4: 140000,
    T5: 150000,
}

const zalo = new Zalo({
    selfListen: false,
    checkUpdate: true,
    logging: true,
})

const cookie = JSON.parse(fs.readFileSync('./cookie.json', 'utf-8'))

const api = await zalo.login({
    cookie,
    imei: '36cc63a1-3232-4680-8c08-87f6960f6f16-3c9fc7ddec9b58823c1c96756dbd45d8',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
})

const users = new Map()
const lmsNotificationUsers = new Map()
const lmstaNotificationUsers = new Map()

function normalizeCommandText(text) {
    return text.trim().replace(/^\/\s+/, '/')
}

function parseCommand(text) {
    const match = normalizeCommandText(text).match(/^\/?([a-zA-Z][\w-]*)(?:\/([^\s]+))?(?:\s+([\s\S]*))?$/)
    if (!match) return null

    return {
        name: match[1].toLowerCase(),
        path: (match[2] || '').trim(),
        args: (match[3] || '').trim(),
    }
}

function parseLoginArgs(args) {
    const modernSyntax = args.match(/^([^\s/]+@[^\s/]+)\s+(.+)$/)
    if (modernSyntax) return { email: modernSyntax[1].trim(), password: modernSyntax[2].trim() }

    const legacySyntax = args.match(/^([^/\s]+@[^/\s]+)\/(.+)$/)
    if (legacySyntax) return { email: legacySyntax[1].trim(), password: legacySyntax[2].trim() }

    return null
}

function parseRank(value) {
    const match = String(value || '')
        .trim()
        .toUpperCase()
        .match(/^T?([0-5])$/)
    return match ? `T${match[1]}` : null
}

function parseMonthYear(value) {
    const match = String(value || '')
        .trim()
        .match(/^(\d{1,2})\/(\d{4})$/)
    if (!match) return null

    const month = Number(match[1])
    const year = Number(match[2])
    if (month < 1 || month > 12) return null

    return { month, year }
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function getSessionKey(message) {
    return `${message.type}:${message.threadId}`
}

function getDocId(value) {
    return String(value).replace(/\//g, '_')
}

function getAuthHeader(user) {
    return user.idToken?.startsWith('Bearer ') ? user.idToken : `Bearer ${user.idToken}`
}

function formatMoney(value) {
    return Math.round(value || 0).toLocaleString('vi-VN') + 'đ'
}

function getMonthStart(month, year) {
    return new Date(year, month - 1, 1).getTime().toString()
}

function getMonthEnd(month, year) {
    return new Date(year, month, 0, 23, 59, 59, 999).getTime().toString()
}

async function reply(message, text) {
    return api.sendMessage(
        {
            msg: text,
            quote: message.data,
        },
        message.threadId,
        message.type,
    )
}

async function sendTyping(message) {
    try {
        await api.sendTypingEvent(message.threadId, message.type)
    } catch (error) {
        console.error('[ZCA-JS] Send typing event error:', error)
    }
}

async function saveUserSession(message, user) {
    const sessionKey = getSessionKey(message)
    users.set(sessionKey, user)

    if (!state.db) return

    await state.db
        .collection('chatbot_users')
        .doc(getDocId(sessionKey))
        .set(
            {
                ...user,
                sessionKey,
                threadId: message.threadId,
                threadType: message.type,
                updatedAt: state.FieldValue?.serverTimestamp?.() || Date.now(),
            },
            { merge: true },
        )
}

async function getUserSession(message) {
    const sessionKey = getSessionKey(message)
    const cachedUser = users.get(sessionKey)
    if (cachedUser) return cachedUser

    if (!state.db) return null

    const doc = await state.db.collection('chatbot_users').doc(getDocId(sessionKey)).get()
    if (!doc.exists) return null

    const user = doc.data()
    users.set(sessionKey, user)
    return user
}

async function ensureFreshToken(message, user) {
    if (!user.refreshToken || !user.expiresAt || Date.now() < user.expiresAt - 60 * 1000) return user

    const data = await MindXService.refreshToken('refresh_token', user.refreshToken)
    const nextUser = {
        ...user,
        idToken: data.id_token || user.idToken,
        refreshToken: data.refresh_token || user.refreshToken,
        expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000,
    }

    await saveUserSession(message, nextUser)
    return nextUser
}

async function ensureFreshTokenForNotification(registration) {
    const user = registration.user
    if (!user.refreshToken || !user.expiresAt || Date.now() < user.expiresAt - 60 * 1000) return user

    const data = await MindXService.refreshToken('refresh_token', user.refreshToken)
    const nextUser = {
        ...user,
        idToken: data.id_token || user.idToken,
        refreshToken: data.refresh_token || user.refreshToken,
        expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000,
    }

    const nextRegistration = { ...registration, user: nextUser, updatedAt: Date.now() }
    lmsNotificationUsers.set(registration.sessionKey, nextRegistration)
    users.set(registration.sessionKey, nextUser)

    if (state.db) {
        await state.db.collection(LMS_NOTIFICATION_COLLECTION).doc(getDocId(registration.sessionKey)).set(nextRegistration, { merge: true })
        await state.db.collection('chatbot_users').doc(getDocId(registration.sessionKey)).set(nextUser, { merge: true })
    }

    return nextUser
}

async function clearSalaryCache(teacherId) {
    if (state.db) {
        const snapshot = await state.db.collection('chatbot_salary_cache').where('teacherId', '==', teacherId).get()
        const batch = state.db.batch()
        snapshot.docs.forEach((doc) => batch.delete(doc.ref))
        await batch.commit()
    }

    for (const key of state.salaryCache.keys()) {
        if (key.startsWith(`chatbot_${teacherId}_`)) state.salaryCache.delete(key)
    }
}

async function getRankForMonth(user, month, year) {
    const defaultRank = user.rankId || DEFAULT_RANK
    const key = `${user.id}_${month}_${year}`

    if (state.db) {
        const doc = await state.db.collection('teacher_ranks').doc(key).get()
        if (doc.exists) return doc.data().rankId || defaultRank
    }

    return state.customRanks.get(key) || defaultRank
}

async function setRankRange(user, from, to, rankId) {
    const writes = []
    let month = from.month
    let year = from.year

    while (year < to.year || (year === to.year && month <= to.month)) {
        const key = `${user.id}_${month}_${year}`
        const data = {
            teacherId: user.id,
            month,
            year,
            rankId,
            updatedAt: state.FieldValue?.serverTimestamp?.() || Date.now(),
        }

        if (state.db) writes.push(state.db.collection('teacher_ranks').doc(key).set(data, { merge: true }))
        else state.customRanks.set(key, rankId)

        month += 1
        if (month > 12) {
            month = 1
            year += 1
        }
    }

    await Promise.all(writes)
    await clearSalaryCache(user.id)
}

async function getSalaryFromCache(cacheKey) {
    if (state.db) {
        const doc = await state.db.collection('chatbot_salary_cache').doc(getDocId(cacheKey)).get()
        if (doc.exists) {
            const data = doc.data()
            if (Date.now() - Number(data.calculatedAt || 0) < SALARY_CACHE_TTL) return data.result
        }
    }

    const cached = state.salaryCache.get(cacheKey)
    if (cached && Date.now() - cached.calculatedAt < SALARY_CACHE_TTL) return cached.result

    return null
}

async function saveSalaryCache(cacheKey, teacherId, result) {
    const data = {
        teacherId,
        result,
        calculatedAt: Date.now(),
    }

    state.salaryCache.set(cacheKey, data)

    if (state.db) {
        await state.db.collection('chatbot_salary_cache').doc(getDocId(cacheKey)).set(data, { merge: true })
    }
}

async function getTimesheetFromCache(cacheKey) {
    if (state.db) {
        const doc = await state.db.collection('chatbot_timesheet_cache').doc(getDocId(cacheKey)).get()
        if (doc.exists) {
            const data = doc.data()
            if (Date.now() - Number(data.cachedAt || 0) < SALARY_CACHE_TTL) return data.items || []
        }
    }

    const cached = state.salaryCache.get(cacheKey)
    if (cached && Date.now() - cached.cachedAt < SALARY_CACHE_TTL) return cached.items

    return null
}

async function saveTimesheetCache(cacheKey, teacherId, items) {
    const data = {
        teacherId,
        items,
        cachedAt: Date.now(),
    }

    state.salaryCache.set(cacheKey, data)

    if (state.db) {
        await state.db.collection('chatbot_timesheet_cache').doc(getDocId(cacheKey)).set(data, { merge: true })
    }
}

async function getTimesheetItems(message, user, month, year) {
    const freshUser = await ensureFreshToken(message, user)
    const cacheKey = `chatbot_timesheet_${freshUser.id}_${month}_${year}`
    const cached = await getTimesheetFromCache(cacheKey)
    if (cached) return cached

    const client = createClient(getAuthHeader(freshUser))
    const rawData = await client.request(GET_TIMESHEET_QUERY, {
        teacherId: freshUser.id,
        startDate: getMonthStart(month, year),
        endDate: getMonthEnd(month, year),
    })

    const items = rawData?.findTimesheetByTeacher || []
    await saveTimesheetCache(cacheKey, freshUser.id, items)
    return items
}

function getItemDate(item) {
    const timeMs = item.date || item.classSessionAttendance?.startTime || item.officeHour?.startTime
    return timeMs ? new Date(Number(timeMs)) : null
}

function getItemLabel(item) {
    return item.classSessionAttendance?.class?.name || item.officeHour?.type || item.type || 'Khác'
}

function getItemStatus(item) {
    return String(item.status || item.classSessionAttendance?.status || item.officeHour?.status || 'UNCHECKED').toUpperCase()
}

function isCheckedItem(item) {
    return getItemStatus(item) === 'CHECKED'
}

function formatDate(date) {
    return date.toLocaleDateString('vi-VN')
}

function getPreviousWeekRange(now = new Date()) {
    const targetDate = new Date(now)
    targetDate.setDate(targetDate.getDate() - 7)

    const start = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0, 0)
    const daysFromMonday = (start.getDay() + 6) % 7
    start.setDate(start.getDate() - daysFromMonday)

    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    end.setHours(23, 59, 59, 999)

    return { start, end }
}

function getLmstaWeekRange(now = new Date()) {
    const today = new Date(now)
    const daysFromMonday = (today.getDay() + 6) % 7
    const prevMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysFromMonday - 7, 0, 0, 0, 0)
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1, 23, 59, 59, 999)
    return { start: prevMonday, end }
}

function getDayRange(date) {
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
    const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
    return { start, end }
}

function getYesterdayRange(now = new Date()) {
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    return getDayRange(yesterday)
}

function getQueryRange(range) {
    return {
        from: range.start.toISOString(),
        to: range.end.toISOString(),
    }
}

function normalizeEmail(email) {
    return String(email || '')
        .trim()
        .toLowerCase()
}

function isLmstaAuthorized(user) {
    return LMSTA_AUTHORIZED_EMAILS.has(normalizeEmail(user?.email))
}

function getTeacherKeys(teacher) {
    return [teacher?.id, teacher?.email, teacher?.username].filter(Boolean).map((value) => String(value).trim().toLowerCase())
}

function createTeacherRoleMap(classItem, slot) {
    const roleMap = new Map()

    for (const entry of [...(classItem.teachers || []), ...(slot.teachers || [])]) {
        const teacher = entry.teacher || {}
        for (const key of getTeacherKeys(teacher)) {
            roleMap.set(key, entry)
        }
    }

    return roleMap
}

function getRoleEntry(roleMap, teacher) {
    for (const key of getTeacherKeys(teacher)) {
        const entry = roleMap.get(key)
        if (entry) return entry
    }

    return null
}

function getTeacherDisplayName(teacher) {
    return teacher?.fullName || teacher?.email || teacher?.username || 'Chưa rõ tên'
}

function getSlotTeachers(classItem, slot) {
    const roleMap = createTeacherRoleMap(classItem, slot)
    const teachers = []
    const seen = new Set()
    const source = slot.teacherAttendance?.length ? slot.teacherAttendance : [...(slot.teachers || []), ...(classItem.teachers || [])]

    for (const item of source) {
        const teacher = item.teacher || {}
        const roleEntry = getRoleEntry(roleMap, teacher) || item
        const roleShortName = roleEntry.role?.shortName || 'N/A'
        const key = getTeacherKeys(teacher)[0] || `${getTeacherDisplayName(teacher)}_${roleShortName}`

        if (seen.has(key)) continue
        seen.add(key)
        teachers.push({
            fullName: getTeacherDisplayName({ ...roleEntry.teacher, ...teacher }),
            roleShortName,
        })
    }

    return teachers
}

function isCurrentUserLecturer(classItem, slot, user) {
    const userEmail = normalizeEmail(user.email)
    if (!userEmail) return false

    const roleMap = createTeacherRoleMap(classItem, slot)
    const source = slot.teacherAttendance?.length ? slot.teacherAttendance : [...(slot.teachers || []), ...(classItem.teachers || [])]

    return source.some((item) => {
        const teacher = item.teacher || {}
        const roleEntry = getRoleEntry(roleMap, teacher) || item
        return roleEntry.role?.shortName === 'LEC' && normalizeEmail(teacher.email || roleEntry.teacher?.email) === userEmail
    })
}

function getStudentAttendanceStatusLabel(status) {
    switch (status) {
        case 'ATTENDED':
            return 'đi đúng giờ'
        case 'LATE_ARRIVED':
            return 'đi trễ'
        case 'ABSENT_WITH_NOTICE':
            return 'nghỉ có phép'
        default:
            return 'nghỉ không phép'
    }
}

function compactClassesForLmsCache(classes) {
    return classes.map((classItem) => ({
        ...classItem,
        slots: (classItem.slots || []).map((slot) => ({
            ...slot,
            studentAttendance: (slot.studentAttendance || []).map((attendance) => ({
                ...attendance,
                comment: attendance.comment != null ? true : null,
            })),
        })),
    }))
}

async function getAllClasses(message, user) {
    const freshUser = await ensureFreshToken(message, user)
    return getAllClassesForUser(freshUser)
}

async function getAllClassesForUser(freshUser) {
    const client = createClient(getAuthHeader(freshUser))
    const rawData = await client.request(GET_CLASSES_QUERY, {
        pageIndex: 0,
        itemsPerPage: LMS_CLASSES_PAGE_SIZE,
        teacherId: freshUser.id,
        orderBy: 'createdAt_desc',
    })
    return compactClassesForLmsCache(rawData?.classes?.data || [])
}

function getLmsReviewItems(classes, user, range) {
    const items = []

    for (const classItem of classes) {
        if (classItem.status !== 'RUNNING') continue

        for (const [slotIndex, slot] of (classItem.slots || []).entries()) {
            const slotDate = slot.date ? new Date(slot.date) : null
            if (!slotDate || Number.isNaN(slotDate.getTime()) || slotDate < range.start || slotDate > range.end) continue
            if (!isCurrentUserLecturer(classItem, slot, user)) continue

            items.push({
                className: classItem.name,
                sessionNumber: slotIndex + 1,
                date: slotDate,
                hasSummary: slot.summary != null && String(slot.summary).trim() !== '',
                teachers: getSlotTeachers(classItem, slot),
                students: slot.studentAttendance || [],
            })
        }
    }

    return items.sort((a, b) => a.date - b.date || a.className.localeCompare(b.className))
}

function hasMissingLmsReview(item) {
    if (!item.hasSummary) return true

    return item.students.some((attendance) => {
        const needsComment = attendance.status === 'ATTENDED' || attendance.status === 'LATE_ARRIVED'
        return needsComment && attendance.comment == null
    })
}

function formatLmsReviewResult(items, range) {
    const lines = [`KIỂM TRA NHẬN XÉT LMS TUẦN ${formatDate(range.start)} - ${formatDate(range.end)}`]

    if (!items.length) {
        lines.push('Không có lớp nào bạn dạy chính trong tuần trước.')
        return lines.join('\n')
    }

    const uncheckedClassCount = items.filter(hasMissingLmsReview).length
    lines.push(`Số lớp dạy: ${items.length}`)
    lines.push(`Số lớp chưa nhận xét: ${uncheckedClassCount}`)
    lines.push('Đã nhận xét: ✅, chưa nhận xét: ❌')

    for (const item of items) {
        const reviewIcon = hasMissingLmsReview(item) ? '❌' : '✅'
        lines.push('', `${reviewIcon} ${item.className} - Buổi ${item.sessionNumber} (${formatDate(item.date)})`)
        lines.push(`Nội dung buổi học: ${item.hasSummary ? '✅' : '❌'}`)
        lines.push(`Giáo viên: ${item.teachers.length ? item.teachers.map((teacher) => `${teacher.fullName} (${teacher.roleShortName})`).join(', ') : 'Chưa có dữ liệu'}`)
        lines.push('Học viên:')

        if (!item.students.length) {
            lines.push('- Chưa có dữ liệu điểm danh học viên')
            continue
        }

        for (const attendance of item.students) {
            const studentName = attendance.student?.fullName || 'Chưa rõ tên'
            const statusLabel = getStudentAttendanceStatusLabel(attendance.status)
            const commentLabel = attendance.status === 'ATTENDED' || attendance.status === 'LATE_ARRIVED' ? (attendance.comment == null ? '❌' : '✅') : ''
            lines.push(`- ${studentName}: ${statusLabel} ${commentLabel}`)
        }
    }

    return lines.join('\n')
}

function formatLmsNotificationResult(items, range) {
    const missingItems = items.filter(hasMissingLmsReview)
    if (!missingItems.length) {
        return `Chúc mừng, bạn thật chăm chỉ, bạn đã nhận xét hết lớp ngày ${formatDate(range.start)}.`
    }

    const lines = [`NHẮC NHẬN XÉT LMS NGÀY ${formatDate(range.start)}`]
    lines.push(`Số lớp chưa nhận xét: ${missingItems.length}`)
    lines.push('Đã nhận xét: ✅, chưa nhận xét: ❌')

    for (const item of missingItems) {
        lines.push('', ` ❌ ${item.className} - Buổi ${item.sessionNumber} (${formatDate(item.date)})`)
        lines.push(`Nội dung buổi học: ${item.hasSummary ? '✅' : '❌'}`)
        lines.push('Học viên cần kiểm tra:')

        const missingStudents = item.students.filter((attendance) => {
            const needsComment = attendance.status === 'ATTENDED' || attendance.status === 'LATE_ARRIVED'
            return needsComment && attendance.comment == null
        })

        if (!missingStudents.length) {
            lines.push('- Không có học viên thiếu nhận xét')
            continue
        }

        for (const attendance of missingStudents) {
            const studentName = attendance.student?.fullName || 'Chưa rõ tên'
            const statusLabel = getStudentAttendanceStatusLabel(attendance.status)
            lines.push(`- ${studentName}: ${statusLabel} ❌`)
        }
    }

    return lines.join('\n')
}

async function sendMessageToThread(threadId, threadType, text) {
    return api.sendMessage(
        {
            msg: text,
        },
        threadId,
        threadType,
    )
}

async function saveLmsNotificationRegistration(message, user) {
    const sessionKey = getSessionKey(message)
    const registration = {
        sessionKey,
        threadId: message.threadId,
        threadType: message.type,
        user,
        enabled: true,
        updatedAt: Date.now(),
    }

    lmsNotificationUsers.set(sessionKey, registration)

    if (state.db) {
        await state.db
            .collection(LMS_NOTIFICATION_COLLECTION)
            .doc(getDocId(sessionKey))
            .set(
                {
                    ...registration,
                    updatedAt: state.FieldValue?.serverTimestamp?.() || Date.now(),
                },
                { merge: true },
            )
    }

    return registration
}

async function destroyLmsNotificationRegistration(message) {
    const sessionKey = getSessionKey(message)
    lmsNotificationUsers.delete(sessionKey)

    if (state.db) {
        await state.db
            .collection(LMS_NOTIFICATION_COLLECTION)
            .doc(getDocId(sessionKey))
            .set(
                {
                    sessionKey,
                    threadId: message.threadId,
                    threadType: message.type,
                    enabled: false,
                    updatedAt: state.FieldValue?.serverTimestamp?.() || Date.now(),
                },
                { merge: true },
            )
    }
}

async function getLmsNotificationRegistrations() {
    if (!state.db) return Array.from(lmsNotificationUsers.values()).filter((registration) => registration.enabled)

    const snapshot = await state.db.collection(LMS_NOTIFICATION_COLLECTION).where('enabled', '==', true).get()
    return snapshot.docs.map((doc) => doc.data()).filter((registration) => registration.threadId && registration.user)
}

async function runLmsNotificationForRegistration(registration, now = new Date()) {
    try {
        const user = await ensureFreshTokenForNotification(registration)
        const range = getYesterdayRange(now)
        const classes = await getAllClassesForUser(user)
        const items = getLmsReviewItems(classes, user, range)
        await sendMessageToThread(registration.threadId, registration.threadType, formatLmsNotificationResult(items, range))
    } catch (error) {
        console.error('[ZCA-JS] LMS notification error:', error)
        await sendMessageToThread(registration.threadId, registration.threadType, `Bot không kiểm tra được LMS hôm nay: ${error.message || 'Lỗi không xác định'}`)
    }
}

async function runLmsNotifications(now = new Date()) {
    const registrations = await getLmsNotificationRegistrations()
    for (const registration of registrations) {
        await runLmsNotificationForRegistration(registration, now)
    }
}

function scheduleLmsNotificationCron() {
    cron.schedule(
        '0 9 * * *',
        async () => {
            try {
                await runLmsNotifications()
            } catch (error) {
                console.error('[ZCA-JS] LMS notification scheduler error:', error)
            }
        },
        {
            timezone: LMS_NOTIFICATION_TIMEZONE,
        },
    )
}

async function ensureFreshTokenForLmstaNotification(registration) {
    const user = registration.user
    if (!user.refreshToken || !user.expiresAt || Date.now() < user.expiresAt - 60 * 1000) return user

    const data = await MindXService.refreshToken('refresh_token', user.refreshToken)
    const nextUser = {
        ...user,
        idToken: data.id_token || user.idToken,
        refreshToken: data.refresh_token || user.refreshToken,
        expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000,
    }

    const nextRegistration = { ...registration, user: nextUser, updatedAt: Date.now() }
    lmstaNotificationUsers.set(registration.sessionKey, nextRegistration)
    users.set(registration.sessionKey, nextUser)

    if (state.db) {
        await state.db.collection(LMSTA_NOTIFICATION_COLLECTION).doc(getDocId(registration.sessionKey)).set(nextRegistration, { merge: true })
        await state.db.collection('chatbot_users').doc(getDocId(registration.sessionKey)).set(nextUser, { merge: true })
    }

    return nextUser
}

async function getAllClassesForLmsta(freshUser, range) {
    const data = await MindXService.login('vuta@mindx.com.vn', 'vut@123')
    const client = createClient('Bearer ' + data.idToken)
    const rawData = await client.request(GET_CLASSES_QUERY_FOR_TE, {
        search: '',
        centres: [LMSTA_CENTRE_ID],
        courses: [],
        courseLines: [],
        statusIn: ['RUNNING'],
        pageIndex: 0,
        itemsPerPage: LMSTA_CLASSES_PAGE_SIZE,
        orderBy: 'createdAt_desc',
        teacherSlot: [],
        passedSessionIndex: null,
        unpassedSessionIndex: null,
        haveSlotIn: getQueryRange(range),
        comments: { criteria: [] },
    })
    return rawData?.classes?.data || []
}

function getLmstaUncheckedSlots(classes, range) {
    const classesWithSlots = new Set()
    const unchecked = []

    for (const classItem of classes) {
        for (const [slotIndex, slot] of (classItem.slots || []).entries()) {
            const slotDate = slot.date ? new Date(slot.date) : null
            if (!slotDate || Number.isNaN(slotDate.getTime()) || slotDate < range.start || slotDate > range.end) continue

            classesWithSlots.add(classItem.name)

            if (slot.summary == null || String(slot.summary).trim() === '') {
                const lecTeacher = (slot.teachers || []).find((t) => t.role?.shortName === 'LEC')
                unchecked.push({
                    className: classItem.name,
                    sessionNumber: slotIndex + 1,
                    date: slotDate,
                    lecTeacher: lecTeacher?.teacher || null,
                })
            }
        }
    }

    return {
        totalClassCount: classesWithSlots.size,
        unchecked: unchecked.sort((a, b) => a.date - b.date || a.className.localeCompare(b.className)),
    }
}

function formatLmstaResult(totalClassCount, unchecked, range) {
    const lines = [`KIỂM TRA NHẬN XÉT LMS GIÁO VIÊN BIÊN HÒA TUẦN ${formatDate(range.start)} - ${formatDate(range.end)}`]
    lines.push(`Cơ sở: ${LMSTA_CENTRE_NAME}`)
    lines.push(`Tổng số lớp học: ${totalClassCount}`)

    const uncheckedClassNames = new Set(unchecked.map((item) => item.className))
    lines.push(`Số lớp chưa nhận xét: ${uncheckedClassNames.size}`)

    if (!unchecked.length) {
        lines.push('Tất cả các lớp đã được nhận xét.')
        return lines.join('\n')
    }

    lines.push('', 'Chi tiết các buổi chưa nhận xét:')
    for (const item of unchecked) {
        const lecName = item.lecTeacher ? getTeacherDisplayName(item.lecTeacher) : 'Chưa rõ'
        lines.push(`- ${item.className} | Buổi ${item.sessionNumber} | ${formatDate(item.date)} | LEC: ${lecName}`)
    }

    return lines.join('\n')
}

function formatLmstaNotificationResult(totalClassCount, unchecked, range) {
    if (!unchecked.length) {
        return `LMSTA: Tất cả ${totalClassCount} lớp tại ${LMSTA_CENTRE_NAME} tuần ${formatDate(range.start)} - ${formatDate(range.end)} đã được nhận xét.`
    }

    const lines = [`NHẮC NHẬN XÉT LMS GIÁO VIÊN BIÊN HÒA - ${LMSTA_CENTRE_NAME}`]
    lines.push(`Tuần: ${formatDate(range.start)} - ${formatDate(range.end)}`)
    lines.push(`Tổng số lớp: ${totalClassCount}`)

    const uncheckedClassNames = new Set(unchecked.map((item) => item.className))
    lines.push(`Số lớp chưa nhận xét: ${uncheckedClassNames.size}`)
    lines.push('', 'Chi tiết các buổi chưa nhận xét:')

    for (const item of unchecked) {
        const lecName = item.lecTeacher ? getTeacherDisplayName(item.lecTeacher) : 'Chưa rõ'
        lines.push(`- ${item.className} | Buổi ${item.sessionNumber} | ${formatDate(item.date)} | LEC: ${lecName}`)
    }

    return lines.join('\n')
}

async function saveLmstaNotificationRegistration(message, user) {
    const sessionKey = getSessionKey(message)
    const registration = {
        sessionKey,
        threadId: message.threadId,
        threadType: message.type,
        user,
        enabled: true,
        updatedAt: Date.now(),
    }

    lmstaNotificationUsers.set(sessionKey, registration)

    if (state.db) {
        await state.db
            .collection(LMSTA_NOTIFICATION_COLLECTION)
            .doc(getDocId(sessionKey))
            .set(
                {
                    ...registration,
                    updatedAt: state.FieldValue?.serverTimestamp?.() || Date.now(),
                },
                { merge: true },
            )
    }

    return registration
}

async function destroyLmstaNotificationRegistration(message) {
    const sessionKey = getSessionKey(message)
    lmstaNotificationUsers.delete(sessionKey)

    if (state.db) {
        await state.db
            .collection(LMSTA_NOTIFICATION_COLLECTION)
            .doc(getDocId(sessionKey))
            .set(
                {
                    sessionKey,
                    threadId: message.threadId,
                    threadType: message.type,
                    enabled: false,
                    updatedAt: state.FieldValue?.serverTimestamp?.() || Date.now(),
                },
                { merge: true },
            )
    }
}

async function getLmstaNotificationRegistrations() {
    if (!state.db) return Array.from(lmstaNotificationUsers.values()).filter((registration) => registration.enabled)

    const snapshot = await state.db.collection(LMSTA_NOTIFICATION_COLLECTION).where('enabled', '==', true).get()
    return snapshot.docs.map((doc) => doc.data()).filter((registration) => registration.threadId && registration.user)
}

async function runLmstaNotificationForRegistration(registration, now = new Date()) {
    try {
        const user = await ensureFreshTokenForLmstaNotification(registration)
        const range = getLmstaWeekRange(now)
        const classes = await getAllClassesForLmsta(user, range)
        const { totalClassCount, unchecked } = getLmstaUncheckedSlots(classes, range)
        await sendMessageToThread(registration.threadId, registration.threadType, formatLmstaNotificationResult(totalClassCount, unchecked, range))
    } catch (error) {
        console.error('[ZCA-JS] LMSTA notification error:', error)
        await sendMessageToThread(registration.threadId, registration.threadType, `Bot không kiểm tra được LMSTA hôm nay: ${error.message || 'Lỗi không xác định'}`)
    }
}

async function runLmstaNotifications(now = new Date()) {
    const registrations = await getLmstaNotificationRegistrations()
    for (const registration of registrations) {
        await runLmstaNotificationForRegistration(registration, now)
    }
}

function scheduleLmstaNotificationCron() {
    cron.schedule(
        '0 9 * * *',
        async () => {
            try {
                await runLmstaNotifications()
            } catch (error) {
                console.error('[ZCA-JS] LMSTA notification scheduler error:', error)
            }
        },
        {
            timezone: LMS_NOTIFICATION_TIMEZONE,
        },
    )
}

function scheduleLmstaNotificationTest(registration) {
    const runAt = getCronDateParts(new Date(Date.now() + 60 * 1000))
    const expression = `${runAt.minute} ${runAt.hour} ${runAt.day} ${runAt.month} *`
    let task = null

    task = cron.schedule(
        expression,
        async () => {
            task.stop()
            try {
                await runLmstaNotificationForRegistration(registration)
            } catch (error) {
                console.error('[ZCA-JS] LMSTA notification test error:', error)
            } finally {
                task.destroy()
            }
        },
        {
            timezone: LMS_NOTIFICATION_TIMEZONE,
        },
    )
}

async function handleLmstaNotification(message, user, isTest = false) {
    const registration = await saveLmstaNotificationRegistration(message, user)

    if (isTest) {
        scheduleLmstaNotificationTest(registration)
        await reply(message, 'Đã đăng ký LMSTA notification và sẽ gửi thông báo test sau 1 phút.')
        return
    }

    await reply(message, 'Đã đăng ký nhận thông báo LMSTA. Bot sẽ báo cáo lúc 9h sáng mỗi ngày.')
}

async function handleLmsta(message, command) {
    const user = await getUserSession(message)
    if (!user) {
        await reply(message, 'Bạn chưa đăng nhập. Gõ login email mật_khẩu để bắt đầu.')
        return
    }

    if (!isLmstaAuthorized(user)) {
        await reply(message, 'Bạn không có quyền sử dụng lệnh này.')
        return
    }

    const args = (command.args || command.path || '').trim().toLowerCase()
    if (args === 'noti destroy') {
        await destroyLmstaNotificationRegistration(message)
        await reply(message, 'Đã hủy đăng ký nhận thông báo LMSTA cho cuộc trò chuyện này.')
        return
    }
    if (args === 'noti') {
        await handleLmstaNotification(message, user)
        return
    }
    if (args === 'noti test') {
        await handleLmstaNotification(message, user, true)
        return
    }
    if (args) {
        await reply(message, 'Cú pháp LMSTA hợp lệ:\nlmsta\nlmsta noti\nlmsta noti test\nlmsta noti destroy')
        return
    }

    await reply(message, 'Bot đang kiểm tra LMSTA, có thể mất khoảng 12-18 giây vì cần tải dữ liệu lớp. Bạn chờ mình xíu nhé.')

    const range = getLmstaWeekRange()
    const freshUser = await ensureFreshToken(message, user)
    const classes = await getAllClassesForLmsta(freshUser, range)
    const { totalClassCount, unchecked } = getLmstaUncheckedSlots(classes, range)
    await reply(message, formatLmstaResult(totalClassCount, unchecked, range))
}

function getCronDateParts(date) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: LMS_NOTIFICATION_TIMEZONE,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hourCycle: 'h23',
    }).formatToParts(date)

    return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]))
}

function scheduleLmsNotificationTest(registration) {
    const runAt = getCronDateParts(new Date(Date.now() + 60 * 1000))
    const expression = `${runAt.minute} ${runAt.hour} ${runAt.day} ${runAt.month} *`
    let task = null

    task = cron.schedule(
        expression,
        async () => {
            task.stop()
            try {
                await runLmsNotificationForRegistration(registration)
            } catch (error) {
                console.error('[ZCA-JS] LMS notification test error:', error)
            } finally {
                task.destroy()
            }
        },
        {
            timezone: LMS_NOTIFICATION_TIMEZONE,
        },
    )
}

function calculateItemSalary(item, rankRate) {
    if (item.type === 'ATTENDANCE_CLASS') return rankRate * 2

    if (item.type !== 'OFFICE_HOUR' || !item.officeHour) return 0

    const officeHourType = item.officeHour.type || ''
    const studentCount = item.officeHour.studentCount || 0
    let hours = 2

    if (item.officeHour.startTime && item.officeHour.endTime) {
        const start = Number(item.officeHour.startTime)
        const end = Number(item.officeHour.endTime)
        if (!Number.isNaN(start) && !Number.isNaN(end)) hours = (end - start) / 3600000
    }

    const typeLower = officeHourType.toLowerCase()
    if (typeLower === 'ta') return 0.75 * rankRate * hours
    if (typeLower === 'makeup' || typeLower === 'dạy bù') return studentCount <= 3 ? 0.75 * rankRate * hours : rankRate * hours
    if (typeLower.includes('trial') || typeLower.includes('trải nghiệm')) {
        if (typeLower.includes('online')) {
            if (studentCount === 1) return 40000
            if (studentCount === 2) return 60000
            if (studentCount >= 3) return 80000
        }
        return 80000 + studentCount * 30000
    }
    if (typeLower === 'workshop') return rankRate * hours
    if (typeLower === 'event' || typeLower === 'sự kiện') return rankRate * 2
    if (typeLower === 'main judge' || typeLower === 'bgk chính') return rankRate * 2
    if (typeLower === 'sub judge' || typeLower === 'bgk phụ') return Math.min(rankRate * 2, 300000)
    if (typeLower === 'lab' || typeLower === 'trực lab') return Math.min(rankRate * 2, 200000)

    return 0
}

async function calculateSalary(message, user, fromMonth, fromYear, toMonth, toYear) {
    const freshUser = await ensureFreshToken(message, user)
    const cacheKey = `chatbot_${freshUser.id}_${fromMonth}_${fromYear}_${toMonth}_${toYear}`
    const cached = await getSalaryFromCache(cacheKey)
    if (cached) return cached

    const client = createClient(getAuthHeader(freshUser))
    const rawData = await client.request(GET_TIMESHEET_QUERY, {
        teacherId: freshUser.id,
        startDate: getMonthStart(fromMonth, fromYear),
        endDate: getMonthEnd(toMonth, toYear),
    })

    const groups = {}
    const months = {}
    const classNames = new Set()
    const items = []
    let totalSalary = 0
    let totalSessions = 0
    let checkedSessions = 0
    let uncheckedSessions = 0

    for (const item of rawData?.findTimesheetByTeacher || []) {
        if (item.classSessionAttendance?.status === 'ABSENT_WITH_NOTICE' || item.status === 'ABSENT_WITH_NOTICE') continue

        const date = getItemDate(item)
        if (!date) continue

        const month = date.getMonth() + 1
        const year = date.getFullYear()
        const rankId = await getRankForMonth(freshUser, month, year)
        const rankRate = RANKS_RATE[rankId] || RANKS_RATE[DEFAULT_RANK]
        const itemSalary = calculateItemSalary(item, rankRate)
        const itemLabel = getItemLabel(item)
        const itemStatus = getItemStatus(item)
        const monthKey = `${year}-${String(month).padStart(2, '0')}`
        const classKey = `${monthKey}_${itemLabel}`

        if (!months[monthKey]) months[monthKey] = { month, year, salary: 0, sessions: 0, ranks: new Set() }
        months[monthKey].salary += itemSalary
        months[monthKey].sessions += 1
        months[monthKey].ranks.add(rankId)

        if (!groups[classKey]) groups[classKey] = { label: itemLabel, month, year, salary: 0, sessions: 0, rankId }
        groups[classKey].salary += itemSalary
        groups[classKey].sessions += 1

        classNames.add(itemLabel)
        if (isCheckedItem(item)) checkedSessions += 1
        else uncheckedSessions += 1
        items.push({
            date: date.getTime(),
            label: itemLabel,
            salary: itemSalary,
            rankId,
            status: itemStatus,
        })

        totalSalary += itemSalary
        totalSessions += 1
    }

    const result = {
        totalSalary,
        totalSessions,
        classCount: classNames.size,
        checkedSessions,
        uncheckedSessions,
        months: Object.values(months)
            .map(({ ranks, ...item }) => ({ ...item, rank: Array.from(ranks).join(', ') || freshUser.rankId || DEFAULT_RANK }))
            .sort((a, b) => a.year - b.year || a.month - b.month),
        details: Object.values(groups).sort((a, b) => b.salary - a.salary),
        items: items.sort((a, b) => a.date - b.date || a.label.localeCompare(b.label)),
    }

    await saveSalaryCache(cacheKey, freshUser.id, result)
    return result
}

function parseSalaryRequest(command) {
    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()
    const value = (command.path || command.args || '').toLowerCase()

    if (!value) return { type: 'month', month: currentMonth, year: currentYear }
    if (value === 'all') return { type: 'all', fromMonth: 1, fromYear: 2020, toMonth: currentMonth, toYear: currentYear }

    const rangeMatch = value.match(/^(\d{1,2})-(\d{1,2})$/)
    if (rangeMatch) return { type: 'range', fromMonth: Number(rangeMatch[1]), fromYear: currentYear, toMonth: Number(rangeMatch[2]), toYear: currentYear }

    const monthYearMatch = value.match(/^(\d{1,2})\/(\d{4})$/)
    if (monthYearMatch) return { type: 'month', month: Number(monthYearMatch[1]), year: Number(monthYearMatch[2]) }

    const monthMatch = value.match(/^(\d{1,2})$/)
    if (monthMatch) return { type: 'month', month: Number(monthMatch[1]), year: currentYear }

    return null
}

function parseCheckRequest(command) {
    const now = new Date()
    const monthValue = command.path || command.args
    const month = monthValue ? Number(monthValue) : now.getMonth() + 1
    if (!Number.isInteger(month) || month < 1 || month > 12) return null

    return {
        month,
        year: now.getFullYear(),
        isCurrentMonth: month === now.getMonth() + 1,
    }
}

function filterFutureTimesheetItems(items, request) {
    if (!request.isCurrentMonth) return items

    const now = new Date()
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime()

    return items.filter((item) => {
        const date = getItemDate(item)
        return date && date.getTime() <= endOfToday
    })
}

function isValidMonthRange(request) {
    const isValidMonth = (month) => Number.isInteger(month) && month >= 1 && month <= 12
    const isValidYear = (year) => Number.isInteger(year) && year >= 2020

    if (request.type === 'month') {
        return isValidMonth(request.month) && isValidYear(request.year)
    }

    return (
        isValidMonth(request.fromMonth) &&
        isValidMonth(request.toMonth) &&
        isValidYear(request.fromYear) &&
        isValidYear(request.toYear) &&
        (request.fromYear < request.toYear || (request.fromYear === request.toYear && request.fromMonth <= request.toMonth))
    )
}

function formatMonthSalary(user, salary, month, year) {
    const rank = salary.months[0]?.rank || user.rankId || DEFAULT_RANK
    const lines = [
        `LƯƠNG THÁNG ${month}/${year} VỚI RANK ${rank}`,
        `Tổng lương: ${formatMoney(salary.totalSalary)}`,
        `Số lớp tham gia: ${salary.classCount}`,
        `Công đã chốt: ${salary.checkedSessions}`,
        `Công chưa chốt: ${salary.uncheckedSessions}`,
        `Rank lương: ${rank}`,
        '',
        'Chi tiết:',
    ]

    if (!salary.details.length) {
        lines.push('Không có dữ liệu lương trong tháng này.')
        return lines.join('\n')
    }

    for (const item of salary.details) {
        lines.push(`- ${item.label}: ${formatMoney(item.salary)} (${item.sessions} công, rank ${item.rankId})`)
    }

    return lines.join('\n')
}

function formatCheckResult(salary, month, year) {
    if (!salary.details.length) return `Không có dữ liệu chấm công tháng ${month}/${year}.`

    const lines = [`CHECK CÔNG THÁNG ${month}/${year}`]
    const itemsByDay = {}
    const uncheckedItems = []

    for (const item of salary.details) {
        const date = new Date(item.date)
        const dayKey = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
        if (!itemsByDay[dayKey]) itemsByDay[dayKey] = { date, items: [] }
        itemsByDay[dayKey].items.push(item)
        if (item.status !== 'CHECKED') uncheckedItems.push({ ...item, date })
    }

    for (const day of Object.values(itemsByDay).sort((a, b) => a.date - b.date)) {
        lines.push('', `== NGÀY ${formatDate(day.date)} ==`)
        for (const item of day.items) {
            lines.push(`- ${item.label}: ${formatMoney(item.salary)} (rank ${item.rankId}) (${item.status})`)
        }
    }

    lines.push('', `CÔNG ĐÃ CHỐT: ${salary.checkedSessions}`)
    lines.push(`CÔNG CHƯA CHỐT: ${salary.uncheckedSessions}`)

    if (uncheckedItems.length) {
        lines.push('', 'CÁC LỚP ĐANG BỊ UNCHECKED:')
        for (const item of uncheckedItems) {
            lines.push(`- ${formatDate(item.date)} - ${item.label}: ${formatMoney(item.salary)} (rank ${item.rankId})`)
        }
    } else {
        lines.push('', 'Không có lớp nào đang bị UNCHECKED.')
    }

    return lines.join('\n')
}

async function formatTimesheetCheckResult(user, timesheetItems, month, year) {
    if (!timesheetItems.length) return `Không có dữ liệu chấm công tháng ${month}/${year}.`

    const lines = [`CHECK CÔNG THÁNG ${month}/${year}`]
    const itemsByDay = {}
    const uncheckedItems = []
    let checkedSessions = 0
    let uncheckedSessions = 0

    for (const item of timesheetItems) {
        if (item.classSessionAttendance?.status === 'ABSENT_WITH_NOTICE' || item.status === 'ABSENT_WITH_NOTICE') continue

        const date = getItemDate(item)
        if (!date) continue

        const rankId = await getRankForMonth(user, date.getMonth() + 1, date.getFullYear())
        const rankRate = RANKS_RATE[rankId] || RANKS_RATE[DEFAULT_RANK]
        const checkItem = {
            date,
            label: getItemLabel(item),
            salary: calculateItemSalary(item, rankRate),
            rankId,
            status: getItemStatus(item),
        }
        const dayKey = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
        if (!itemsByDay[dayKey]) itemsByDay[dayKey] = { date, items: [] }
        itemsByDay[dayKey].items.push(checkItem)

        if (checkItem.status === 'CHECKED') checkedSessions += 1
        else {
            uncheckedSessions += 1
            uncheckedItems.push(checkItem)
        }
    }

    for (const day of Object.values(itemsByDay).sort((a, b) => a.date - b.date)) {
        lines.push('', `== NGÀY ${formatDate(day.date)} ==`)
        for (const item of day.items) {
            lines.push(`- ${item.label}: ${formatMoney(item.salary)} (rank ${item.rankId}) (${item.status})`)
        }
    }

    lines.push('', `CÔNG ĐÃ CHỐT: ${checkedSessions}`)
    lines.push(`CÔNG CHƯA CHỐT: ${uncheckedSessions}`)

    if (uncheckedItems.length) {
        lines.push('', 'CÁC LỚP ĐANG BỊ UNCHECKED:')
        for (const item of uncheckedItems) {
            lines.push(`- ${formatDate(item.date)} - ${item.label}: ${formatMoney(item.salary)} (rank ${item.rankId})`)
        }
    } else {
        lines.push('', 'Không có lớp nào đang bị UNCHECKED.')
    }

    return lines.join('\n')
}

function formatRangeSalary(salary, title) {
    if (!salary.months.length) return `${title}\nKhông có dữ liệu lương.`

    const lines = [title]
    lines.push(`\nBạn có thể set rank mặc định cho từng tháng bằng lệnh VD: setrank 03/2025 08/2025 3: set rank T3 cho khoảng thời gian đó.\n`)
    for (const item of salary.months) {
        lines.push(`- Tháng ${item.month}/${item.year}: ${formatMoney(item.salary)} (${item.sessions} buổi, rank ${item.rank})`)
    }
    lines.push(`Tổng cộng: ${formatMoney(salary.totalSalary)}`)
    return lines.join('\n')
}

async function handleLogin(message, args) {
    if (message.type !== ThreadType.User) {
        await reply(message, 'Vui lòng nhắn riêng cho bot để đăng nhập. Không nên gửi mật khẩu trong nhóm.')
        return
    }

    const credentials = parseLoginArgs(args)
    if (!credentials || !isValidEmail(credentials.email)) {
        await reply(message, 'Cú pháp đúng: login email mật_khẩu\nVD: login abc@mindx.net.vn password123@')
        return
    }

    try {
        const data = await MindXService.login(credentials.email, credentials.password)
        const lookupResponse = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=AIzaSyAh2Au-mk5ci-hN83RUBqj1fsAmCMdvJx4', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken: data.idToken }),
        })
        const lookupData = await lookupResponse.json()
        const customAttributes = JSON.parse(lookupData.users?.[0]?.customAttributes || '{}')

        if (!customAttributes.id) throw new Error('Không tìm thấy thông tin giáo viên.')

        const oldUser = await getUserSession(message)
        const user = {
            displayName: data.displayName,
            email: data.email,
            localId: data.localId,
            id: customAttributes.id,
            idToken: data.idToken,
            refreshToken: data.refreshToken,
            expiresAt: Date.now() + Number(data.expiresIn || 3600) * 1000,
            rankId: oldUser?.rankId || DEFAULT_RANK,
        }

        await saveUserSession(message, user)
        await reply(message, `Đăng nhập thành công: ${user.displayName || user.email}\nEmail: ${user.email}\nRank hiện tại: ${user.rankId}\nGõ help để xem các lệnh hỗ trợ.`)
    } catch (error) {
        console.error(error)
        await reply(message, error.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.')
    }
}

async function handleRank(message, command) {
    const user = await getUserSession(message)
    if (!user) {
        await reply(message, 'Bạn chưa đăng nhập. Gõ login email mật_khẩu để bắt đầu.')
        return
    }

    const rankId = parseRank(command.path || command.args)
    if (!rankId) {
        await reply(message, 'Cú pháp đúng: rank số_rank\nVD: rank 3 hoặc rank/5')
        return
    }

    const nextUser = { ...user, rankId }
    await saveUserSession(message, nextUser)
    await clearSalaryCache(user.id)
    await reply(message, `Đã cập nhật rank mặc định thành ${rankId}.`)
}

async function handleSetRank(message, command) {
    const user = await getUserSession(message)
    if (!user) {
        await reply(message, 'Bạn chưa đăng nhập. Gõ login email mật_khẩu để bắt đầu.')
        return
    }

    const currentMonthRank = parseRank(command.path || command.args)
    if (currentMonthRank && !command.args.includes(' ')) {
        const now = new Date()
        const monthYear = { month: now.getMonth() + 1, year: now.getFullYear() }
        await setRankRange(user, monthYear, monthYear, currentMonthRank)
        await reply(message, `Đã set rank ${currentMonthRank} cho tháng ${String(monthYear.month).padStart(2, '0')}/${monthYear.year}.`)
        return
    }

    const [fromValue, toValue, rankValue] = command.args.split(/\s+/)
    const from = parseMonthYear(fromValue)
    const to = parseMonthYear(toValue)
    const rankId = parseRank(rankValue)

    if (!from || !to || !rankId || to.year < from.year || (to.year === from.year && to.month < from.month)) {
        await reply(message, 'Cú pháp đúng: setrank thời_gian_bắt_đầu thời_gian_kết_thúc rank\nVD: setrank 03/2025 08/2025 3')
        return
    }

    await setRankRange(user, from, to, rankId)
    await reply(message, `Đã set rank ${rankId} từ ${String(from.month).padStart(2, '0')}/${from.year} đến ${String(to.month).padStart(2, '0')}/${to.year}.`)
}

async function handleSalary(message, command) {
    const user = await getUserSession(message)
    if (!user) {
        await reply(message, 'Bạn chưa đăng nhập. Gõ login email mật_khẩu để bắt đầu.')
        return
    }

    const request = parseSalaryRequest(command)
    if (!request || !isValidMonthRange(request)) {
        await reply(message, 'Cú pháp lương hợp lệ:\nsalary\nsalary 3\nsalary 3-5\nsalary 3/2025\nsalary all')
        return
    }

    if (request.type === 'month') {
        const salary = await calculateSalary(message, user, request.month, request.year, request.month, request.year)
        await reply(message, formatMonthSalary(user, salary, request.month, request.year))
        return
    }

    const salary = await calculateSalary(message, user, request.fromMonth, request.fromYear, request.toMonth, request.toYear)
    const title =
        request.type === 'all'
            ? `TẤT CẢ LƯƠNG TỪ ${request.fromMonth}/${request.fromYear} ĐẾN ${request.toMonth}/${request.toYear}`
            : `TỔNG LƯƠNG THÁNG ${request.fromMonth}-${request.toMonth}/${request.fromYear}`
    await reply(message, formatRangeSalary(salary, title))
}

async function handleCheck(message, command) {
    const user = await getUserSession(message)
    if (!user) {
        await reply(message, 'Bạn chưa đăng nhập. Gõ login email mật_khẩu để bắt đầu.')
        return
    }

    const request = parseCheckRequest(command)
    if (!request) {
        await reply(message, 'Cú pháp check hợp lệ:\ncheck\ncheck 5')
        return
    }

    const timesheetItems = await getTimesheetItems(message, user, request.month, request.year)
    const visibleItems = filterFutureTimesheetItems(timesheetItems, request)
    await reply(message, await formatTimesheetCheckResult(user, visibleItems, request.month, request.year))
}

async function handleLmsNotification(message, user, isTest = false) {
    const registration = await saveLmsNotificationRegistration(message, user)

    if (isTest) {
        scheduleLmsNotificationTest(registration)
        await reply(message, 'Đã đăng ký LMS notification và sẽ gửi thông báo test sau 1 phút.')
        return
    }

    await reply(message, 'Đã đăng ký nhận thông báo LMS. Bot sẽ nhắc lúc 9h sáng nếu lớp hôm trước còn thiếu nhận xét.')
}

async function handleLms(message, command) {
    const user = await getUserSession(message)
    if (!user) {
        await reply(message, 'Bạn chưa đăng nhập. Gõ login email mật_khẩu để bắt đầu.')
        return
    }

    const args = (command.args || command.path || '').trim().toLowerCase()
    if (args === 'noti destroy') {
        await destroyLmsNotificationRegistration(message)
        await reply(message, 'Đã hủy đăng ký nhận thông báo LMS cho cuộc trò chuyện này.')
        return
    }
    if (args === 'noti') {
        await handleLmsNotification(message, user)
        return
    }
    if (args === 'noti test') {
        await handleLmsNotification(message, user, true)
        return
    }
    if (args) {
        await reply(message, 'Cú pháp LMS hợp lệ:\nlms\nlms noti\nlms noti test\nlms noti destroy')
        return
    }

    await reply(message, 'Bot đang kiểm tra LMS, có thể mất khoảng 12-18 giây vì cần tải dữ liệu lớp. Bạn chờ mình xíu nhé.')

    const range = getPreviousWeekRange()
    const classes = await getAllClasses(message, user)

    const items = getLmsReviewItems(classes, user, range)
    await reply(message, formatLmsReviewResult(items, range))
}

async function handleMe(message) {
    const user = await getUserSession(message)
    if (!user) {
        await reply(message, 'Bạn chưa đăng nhập. Gõ login email mật_khẩu để bắt đầu.')
        return
    }

    await reply(message, [`Tên đăng nhập: ${user.displayName || 'Chưa có'}`, `Email: ${user.email}`, `Rank hiện tại: ${user.rankId || DEFAULT_RANK}`].join('\n'))
}

async function handleMessage(message) {
    if (message.isSelf || typeof message.data.content !== 'string') return

    await sendTyping(message)

    const command = parseCommand(message.data.content)
    if (!command) {
        await reply(message, 'Gõ help để xem các lệnh hỗ trợ.')
        return
    }

    switch (command.name) {
        case 'help':
            await reply(
                message,
                [
                    'Các lệnh hỗ trợ:',
                    'login email mật_khẩu - Đăng nhập MindX',
                    'me - Xem tên, email và rank',
                    'logout - Đăng xuất',
                    '',
                    'rank 3 - Set rank mặc định T3',
                    `setrank 3 - Set rank T3 cho tháng ${new Date().getMonth() + 1}/${new Date().getFullYear()}`,
                    'setrank 03/2025 08/2025 3 - Set rank theo khoảng thời gian',
                    '',
                    `salary - Xem lương và chi tiết tháng ${new Date().getMonth() + 1}/${new Date().getFullYear()}`,
                    `salary 3 - Xem lương và chi tiết tháng 3/${new Date().getFullYear()}`,
                    `salary 3-5 - Xem tổng lương tháng 3/${new Date().getFullYear()} đến 5/${new Date().getFullYear()}`,
                    'salary 3/2025 - Xem lương tháng 3/2025',
                    'salary all - Xem tất cả lương',
                    '',

                    `check - Check công tháng ${new Date().getMonth() + 1}/${new Date().getFullYear()} theo ngày`,
                    'check 5 - Check công tháng 5 theo ngày',
                    '',
                    'lms - Kiểm tra nhận xét các lớp đang dạy trong tuần trước',
                    'lms noti - Đăng ký nhận thông báo khi có lớp và học viên chưa nhận xét',
                    'lms noti test - Gửi thông báo LMS test sau 1 phút',
                    'lms noti destroy - Hủy đăng ký nhận thông báo LMS',

                    '',
                    'lmsta - Kiểm tra nhận xét các lớp tại Đồng Nai - 253 Phạm Văn Thuận trong tuần trước (chỉ dành cho TE)',
                    'lmsta noti - Đăng ký nhận báo cáo LMSTA mỗi ngày lúc 9h',
                    'lmsta noti test - Gửi thông báo LMSTA test sau 1 phút',
                    'lmsta noti destroy - Hủy đăng ký nhận thông báo LMSTA',

                    '',
                    'Tất cả tin nhắn bạn nhắn tin cho bot đều được bảo mật tuyệt đối, tin nhắn sẽ xóa ngay sau khi trả lời cho bạn và không lưu lại trên server dưới bất kỳ hình thức nào. Bạn có thể yên tâm sử dụng các lệnh trên mà không lo bị lộ thông tin cá nhân hay tài khoản.',
                    '',
                    'Theo dõi lương trực quan hơn qua trang web:\nhttps://tts.lrm.io.vn',
                ].join('\n'),
            )
            break
        case 'login':
            await handleLogin(message, command.args)
            break
        case 'rank':
            await handleRank(message, command)
            break
        case 'setrank':
            await handleSetRank(message, command)
            break
        case 'salary':
            await handleSalary(message, command)
            break
        case 'check':
            await handleCheck(message, command)
            break
        case 'lms':
            await handleLms(message, command)
            break
        case 'lmsta':
            await handleLmsta(message, command)
            break
        case 'logout':
            users.delete(getSessionKey(message))
            if (state.db)
                await state.db
                    .collection('chatbot_users')
                    .doc(getDocId(getSessionKey(message)))
                    .delete()
            await reply(message, 'Đã đăng xuất.')
            break
        case 'me':
            await handleMe(message)
            break
        default:
            await reply(message, 'Lệnh không hợp lệ. Gõ help để xem các lệnh hỗ trợ.')
    }
}

api.listener.on('message', (message) => {
    handleMessage(message).catch((error) => {
        console.error('[ZCA-JS] Message handler error:', error)
    })
})

api.listener.start()
scheduleLmsNotificationCron()
scheduleLmstaNotificationCron()

export default router
