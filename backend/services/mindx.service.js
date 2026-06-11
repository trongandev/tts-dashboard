class MindXService {
    async login(email, password) {
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
            return data
        }
    }

    async refreshToken(grant_type, refresh_token) {
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
            return data
        }
    }
}

export default new MindXService()
