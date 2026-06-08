const express = require('express')
const cors = require('cors')
const compression = require('compression')
const morgan = require('morgan')
const dotenv = require('dotenv')
const { GraphQLClient } = require('graphql-request')
const { GET_CLASSES_QUERY, GET_TIMESHEET_QUERY, FIND_INFO_QUERY } = require('./queries')
const cache = require('./cache')
const { createClient } = require('./graphqlClient')

const app = express()
dotenv.config()
app.use(cors())
app.use(express.json())

// dùng để log ra các request đến server
app.use(morgan('dev'))
// dùng để nén dữ liệu trước khi gửi về client
app.use(compression())
const router = express.Router()
app.use('/api', router)

router.post('/login', async (req, res, next) => {
    const { email, password } = req.body
    // Tìm user theo email
    //check trên hệ thống mindx
    const api = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=AIzaSyAh2Au-mk5ci-hN83RUBqj1fsAmCMdvJx4`
    const response = await fetch(api, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            clientType: 'CLIENT_TYPE_WEB',
            email: email,
            password: password,
            returnSecureToken: true,
        }),
    })
    const data = await response.json()
    if (data.error && data.error.code === 400 && data.error.message === 'EMAIL_NOT_FOUND') {
        throw new Error('Email không tồn tại')
    } else if (data.error && data.error.code === 400 && data.error.message === 'INVALID_PASSWORD') {
        throw new Error('Mật khẩu không đúng')
    } else {
        res.json(data)
    }
})

router.post('/refresh-token', async (req, res, next) => {
    const { grant_type, refresh_token } = req.body
    // Tìm user theo email
    //check trên hệ thống mindx
    const api = `https://securetoken.googleapis.com/v1/token?key=AIzaSyAh2Au-mk5ci-hN83RUBqj1fsAmCMdvJx4`
    const response = await fetch(api, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            grant_type: grant_type,
            refresh_token: refresh_token,
        }),
    })
    const data = await response.json()
    if (data.error && data.error.code === 400 && data.error.message === 'EMAIL_NOT_FOUND') {
        throw new Error('Email không tồn tại')
    } else if (data.error && data.error.code === 400 && data.error.message === 'INVALID_PASSWORD') {
        throw new Error('Mật khẩu không đúng')
    } else {
        res.json(data)
    }
})

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
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
            startDate = firstDay.toISOString().split('T')[0]
        }

        if (!endDate) {
            // lấy ra ngày cuối cùng của tháng hiện tại
            const now = new Date()
            const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
            endDate = lastDay.toISOString().split('T')[0]
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

const PORT = 5001
app.listen(PORT, () => console.log(`Server running in http://localhost:${PORT}`))
