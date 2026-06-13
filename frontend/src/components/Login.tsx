import React, { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Eye, EyeOff, BookOpen } from "lucide-react"
import { useUser } from "../contexts/UserContext"
import { useMutation } from "@tanstack/react-query"
const getCookie = (name: string) => {
    const value = `; ${document.cookie}`
    const parts = value.split(`; ${name}=`)
    if (parts.length === 2) return parts.pop()?.split(";").shift()
    return null
}

export default function Login() {
    const navigate = useNavigate()
    const { setUser } = useUser()
    const [showPassword, setShowPassword] = useState(false)
    const [role, setRole] = useState<"teacher" | "manager">("teacher")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")

    const loginMutation = useMutation({
        mutationFn: async () => {
            const response = await fetch(`${import.meta.env.VITE_API_ENDPOINT}/api/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ email, password }),
            })

            if (!response.ok) {
                throw new Error("Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.")
            }

            const data = await response.json()
            if (data.idToken) {
                const expires = new Date()
                expires.setTime(expires.getTime() + 7 * 24 * 60 * 60 * 1000)
                document.cookie = `idToken=${data.idToken};expires=${expires.toUTCString()};path=/;Secure;SameSite=None`
                const refreshRes = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=AIzaSyAh2Au-mk5ci-hN83RUBqj1fsAmCMdvJx4", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ idToken: data.idToken }),
                })
                const resData = await refreshRes.json()
                const customAttributes = JSON.parse(resData.users[0].customAttributes)
                if (customAttributes) {
                    let token = getCookie("accessToken")
                    if (!token) token = getCookie("idToken")
                    if (!token) throw new Error("Không tìm thấy token xác thực, vui lòng đăng nhập lại.")

                    const authHeader = token.startsWith("Bearer ") ? token : `Bearer ${token}`
                    const reqInfo = await fetch(`${import.meta.env.VITE_API_ENDPOINT}/api/find-info`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: authHeader,
                        },
                        body: JSON.stringify({ payload: { id: customAttributes.id } }),
                    })
                    const res = await reqInfo.json()
                    if (res) {
                        const infoData = res.users.findInfoInRoleById[0].info
                        setUser({
                            displayName: infoData.fullName,
                            email: infoData.email,
                            localId: infoData.user,
                            id: infoData._id,
                            username: customAttributes.name,
                        })
                    }
                }
                if (data.refreshToken) {
                    localStorage.setItem("refreshToken", data.refreshToken)
                    const refreshRes = await fetch(`${import.meta.env.VITE_API_ENDPOINT}/api/refresh-token`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ grant_type: "refresh_token", refresh_token: data.refreshToken }),
                    })
                    if (refreshRes.ok) {
                        const refreshData = await refreshRes.json()
                        if (refreshData.access_token) {
                            const expires = new Date()
                            expires.setTime(expires.getTime() + 7 * 24 * 60 * 60 * 1000)
                            document.cookie = `accessToken=${refreshData.access_token};expires=${expires.toUTCString()};path=/;Secure;SameSite=None`
                        }
                    }
                }
            }

            return data
        },
        onSuccess: () => {
            navigate("/")
        },
        onError: (err: any) => {
            setError(err.message || "Có lỗi xảy ra")
        },
    })

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault()
        setError("")
        loginMutation.mutate()
    }

    return (
        <div className="h-dvh min-h-screen overflow-y-auto bg-[#F3F4F6] flex items-stretch md:items-center justify-start md:justify-center p-4 font-sans">
            <div className="w-full max-w-[1000px] min-h-full  md:h-[600px] bg-white rounded-2xl shadow-2xl flex flex-col md:flex-row">
                {/* Left Side - Banner */}
                <div className="w-full md:w-[40%] bg-burgundy text-white p-8 md:p-10 flex flex-col justify-between relative overflow-hidden shrink-0">
                    {/* Subtle background pattern or gradient could go here */}
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-8 md:mb-16">
                            <div className="w-10 h-10 bg-white text-burgundy rounded-lg flex items-center justify-center font-bold text-xl">
                                <BookOpen size={24} />
                            </div>
                            <div className="font-bold text-2xl tracking-wide">
                                mindX
                                <div className="text-[10px] font-normal tracking-normal uppercase opacity-90 -mt-1">Technology School</div>
                            </div>
                        </div>

                        <h1 className="text-2xl md:text-3xl font-bold mb-4 leading-tight">
                            Teacher Schedule
                            <br className="hidden md:block" />
                            <span className="md:hidden"> </span>& Salary (TSS)
                        </h1>
                        <p className="text-white/80 text-sm leading-relaxed max-w-[280px]">
                            Hệ thống theo dõi lịch dạy, quản lý danh sách lớp, thời gian biểu và xem thông tin lương dành cho giáo viên.
                        </p>
                    </div>

                    <div className="relative z-10 mt-8 md:mt-auto text-sm opacity-80">Teaching Team</div>
                </div>

                {/* Right Side - Form */}
                <div className="w-full md:w-[60%] p-8 md:p-12 flex flex-col justify-center items-center">
                    <div className="w-full max-w-[400px]">
                        <div className="text-center mb-8">
                            <h2 className="text-burgundy font-bold text-xl mb-3">MindX Technology School</h2>
                            <h3 className="text-slate-800 font-bold text-2xl mb-2">Chào mừng bạn đến với TSS</h3>
                            <p className="text-slate-500 text-sm">Lựa chọn vai trò của bạn để tiếp tục</p>
                        </div>

                        {/* Role Selection */}
                        <div className="flex justify-center gap-4 mb-6">
                            <button
                                type="button"
                                onClick={() => setRole("teacher")}
                                className={`px-8 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                                    role === "teacher" ? "bg-burgundy text-white border-transparent" : "bg-white text-burgundy border border-burgundy"
                                }`}
                            >
                                Giáo viên
                            </button>
                            <button
                                type="button"
                                onClick={() => setRole("manager")}
                                className={`px-8 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                                    role === "manager" ? "bg-burgundy text-white border-transparent" : "bg-white text-burgundy border border-burgundy"
                                }`}
                            >
                                Quản lý
                            </button>
                        </div>

                        <p className="text-center text-slate-500 text-xs mb-6">
                            Đăng nhập bằng tài khoản <span className="text-burgundy hover:underline cursor-pointer">https://lms.mindx.edu.vn/</span>
                        </p>

                        <form onSubmit={handleLogin} className="space-y-5">
                            {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg mb-4">{error}</div>}
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1.5">Email / Mã đăng nhập</label>
                                <input
                                    type="text"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-[#EBF0F6] border border-transparent focus:border-burgundy/30 focus:bg-white focus:ring-2 focus:ring-burgundy/10 rounded-lg px-4 py-3 text-sm text-slate-800 outline-none transition-all"
                                    placeholder="Nhập email hoặc mã đăng nhập"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1.5">Mật khẩu</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-[#EBF0F6] border border-transparent focus:border-burgundy/30 focus:bg-white focus:ring-2 focus:ring-burgundy/10 rounded-lg px-4 py-3 text-sm text-slate-800 outline-none transition-all pr-10"
                                        placeholder="Nhập mật khẩu"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center">
                                <input type="checkbox" id="remember" className="w-4 h-4 rounded border-slate-300 text-burgundy focus:ring-burgundy/20" />
                                <label htmlFor="remember" className="ml-2 text-sm text-slate-500 cursor-pointer">
                                    Lưu tài khoản
                                </label>
                            </div>

                            <button
                                type="submit"
                                disabled={loginMutation.isPending}
                                className="w-full bg-burgundy text-white rounded-lg py-3 font-bold text-sm hover:bg-burgundy-hover transition-colors mt-2 disabled:bg-burgundy/70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {loginMutation.isPending ? "Đang xử lý..." : "Đăng nhập"}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    )
}
