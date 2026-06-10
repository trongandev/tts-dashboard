import React, { useState, useRef } from 'react';
import Sidebar from './Sidebar';
import Footer from './Footer';
import { LogOut, Info, Github, Mail, ShieldAlert } from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { useNavigate } from 'react-router-dom';

export default function About() {
  const { user, setUser } = useUser();
  const navigate = useNavigate();
  const displayName = user?.displayName || user?.username || 'Người dùng';

  const getInitials = (name?: string) => {
    if (!name || name === 'Người dùng') return 'U';
    const parts = name.split(' ').filter(p => p.length > 0);
    if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  const [showHeader, setShowHeader] = useState(true);
  const lastScrollY = useRef(0);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const currentScrollY = e.currentTarget.scrollTop;
    if (currentScrollY > lastScrollY.current + 10) {
      setShowHeader(false);
    } else if (currentScrollY < lastScrollY.current - 10) {
      setShowHeader(true);
    }
    lastScrollY.current = currentScrollY;
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#F9FAFB]">
      <Sidebar />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col bg-[#F9FAFB] overflow-hidden relative">
        {/* Mobile Top Navigation */}
        <div className={`md:hidden flex items-center justify-between px-4 bg-burgundy text-white transition-all duration-300 overflow-hidden flex-shrink-0 ${showHeader ? 'h-[60px]' : 'h-0'}`}>
          <h1 className="text-xl font-bold tracking-tight">
            TSS<span className="text-xs font-light opacity-70 align-top ml-1">Portal</span>
          </h1>
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-white/20 border border-white/30 flex items-center justify-center font-bold text-sm">
              {getInitials(displayName)}
            </div>
            <button
              onClick={() => {
                setUser(null);
                document.cookie = 'accessToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
                document.cookie = 'idToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
                navigate('/login');
              }}
              className="text-white/70 hover:text-white p-1 transition-colors"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-20 md:pb-8" onScroll={handleScroll}>
          <div className="max-w-4xl mx-auto space-y-6">
            <header className="mb-6 md:mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-3">
                <Info className="text-burgundy" size={32} />
                Về chúng tôi
              </h2>
              <p className="text-sm text-slate-500 font-medium mt-2">Thông tin dự án và liên hệ</p>
            </header>

            <div className="bg-white p-6 md:p-10 rounded-2xl shadow-sm border border-slate-100 space-y-8">

              <section className="space-y-4">
                <h3 className="text-xl font-bold text-slate-800">Tác giả</h3>
                <div className="flex items-center gap-4 text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="w-12 h-12 bg-burgundy/10 text-burgundy rounded-full flex items-center justify-center text-xl font-bold">
                    A
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-lg">Nguyễn Trọng An</p>
                    <div className="flex flex-wrap items-center gap-4 mt-1 text-sm">
                      <a href="https://github.com/trongandev" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-burgundy transition-colors">
                        <Github size={16} />
                        trongandev
                      </a>
                      <a href="mailto:trongandev@gmail.com" className="flex items-center gap-1.5 hover:text-burgundy transition-colors">
                        <Mail size={16} />
                        trongandev@gmail.com
                      </a>
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <ShieldAlert className="text-orange-500" size={24} />
                  Miễn trừ trách nhiệm & Bản quyền
                </h3>
                <div className="bg-orange-50 border border-orange-100 text-orange-800 p-5 rounded-xl text-sm leading-relaxed space-y-3">
                  <p>
                    Sản phẩm này được tạo ra hoàn toàn với mục đích phi lợi nhuận, nhằm giúp đỡ các Mentor của MindX kiểm tra và theo dõi công lương của mình một cách minh bạch và rõ ràng hơn.
                  </p>
                  <p>
                    <strong>Lưu ý:</strong> Ứng dụng có sử dụng API nội bộ từ hệ thống của MindX. Chúng tôi không lưu trữ bất kỳ dữ liệu cá nhân hay thông tin nhạy cảm nào của bạn trên hệ thống của chúng tôi. Mọi dữ liệu đều được truyền trực tiếp đến API của MindX.
                  </p>
                  <p className="font-medium text-orange-900 pt-2 border-t border-orange-200">
                    Nếu có bất kỳ khiếu nại nào về bản quyền, vi phạm chính sách hoặc yêu cầu gỡ bỏ, xin vui lòng gửi email trực tiếp cho tác giả qua địa chỉ: <a href="mailto:trongandev@gmail.com" className="font-bold hover:underline">trongandev@gmail.com</a>. Chúng tôi sẽ lập tức xử lý và gỡ bỏ.
                  </p>
                </div>
              </section>

            </div>

            <Footer />
          </div>
        </div>
      </main>
    </div>
  );
}
