import express from 'express'
import cors from 'cors'
import compression from 'compression'
import morgan from 'morgan'
import dotenv from 'dotenv'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import mindxRouter from './routers/mindx.js'
import chatRouter from './routers/chatbot.js'
import state from './state.js'
import serviceAccount from './firebase-service-account.json' with { type: 'json' }

const app = express()
dotenv.config()

let db = null
try {
    const firebaseApp = initializeApp({
        credential: cert(serviceAccount),
    })
    db = getFirestore(firebaseApp)
    state.db = db
    state.FieldValue = FieldValue
    console.log('Firebase Admin initialized successfully.')
} catch (e) {
    console.log('Firebase Admin not initialized. Using memory cache fallback.', e.message)
}

app.use(cors())
app.use(express.json())

// dùng để log ra các request đến server
app.use(morgan('dev'))
// dùng để nén dữ liệu trước khi gửi về client
app.use(compression())
app.use('/api', mindxRouter)
app.use('/chat', chatRouter)

const PORT = 5001
app.listen(PORT, () => console.log(`Server running in http://localhost:${PORT}`))
