import React, { useState, useRef } from 'react';
import Sidebar from './Sidebar';
import Footer from './Footer';
import { LogOut, Puzzle, Download, X } from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { useNavigate } from 'react-router-dom';

export default function Extension() {
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
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
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
          <div className="max-w-5xl mx-auto space-y-6">
            <header className="mb-6 md:mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-3">
                <Puzzle className="text-burgundy" size={32} />
                Tiện ích mở rộng
              </h2>
              <p className="text-sm text-slate-500 font-medium mt-2">Các công cụ hỗ trợ giảng dạy hiệu quả trên LMS</p>
            </header>

            <div className="bg-white p-6 md:p-10 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-8 items-start">
              <img src="/ext-icon.png" alt="Auto Comment MindX Logo" className="w-24 h-24 md:w-32 md:h-32 rounded-3xl shadow-sm border border-slate-100 object-cover shrink-0" />

              <div className="space-y-4 flex-1">
                <h3 className="text-2xl md:text-3xl font-bold text-slate-800">Auto Comment MindX</h3>
                <p className="text-slate-600 text-base md:text-lg leading-relaxed">
                  Một công cụ đắc lực giúp nhận xét nhanh trên LMS MindX. Extension này tự động chọn các thông tin phù hợp, tự viết nhận xét trên các checkpoint, hỗ trợ tạo mẫu nhận xét nhanh và sao chép nội dung buổi học chỉ với một cú click.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 pt-2">
                  <a
                    href="https://chromewebstore.google.com/detail/gglmaplkojmbdfambodhmbdkngklhpmo?utm_source=item-share-cb"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 bg-burgundy hover:bg-burgundy/90 text-white font-bold py-3 px-6 rounded-xl transition-colors shadow-sm"
                  >
                    <Download size={20} />
                    Cài đặt trên Chrome
                  </a>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col gap-3">
                <h4 className="font-bold text-slate-800 text-center text-sm uppercase">Sao chép nội dung học nhanh</h4>
                <div
                  className="rounded-xl border border-slate-100 overflow-hidden bg-slate-50 flex-1 flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => setSelectedImage('/ext1.png')}
                >
                  <img src="/ext1.png" alt="Tính năng 1" className="w-full h-auto object-cover" />
                </div>
              </div>
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col gap-3">
                <h4 className="font-bold text-slate-800 text-center text-sm uppercase">Tự động điền đánh giá</h4>
                <div
                  className="rounded-xl border border-slate-100 overflow-hidden bg-slate-50 flex-1 flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => setSelectedImage('/ext2.png')}
                >
                  <img src="/ext2.png" alt="Tính năng 2" className="w-full h-auto object-cover" />
                </div>
              </div>
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col gap-3">
                <h4 className="font-bold text-slate-800 text-center text-sm uppercase">Tạo nhanh đánh giá</h4>
                <div
                  className="rounded-xl border border-slate-100 overflow-hidden bg-slate-50 flex-1 flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => setSelectedImage('/ext3.png')}
                >
                  <img src="/ext3.png" alt="Tính năng 3" className="w-full h-auto object-cover" />
                </div>
              </div>
            </div>

            <Footer />
          </div>
        </div>
      </main>

      {/* Image Zoom Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 transition-all duration-300 opacity-100"
          onClick={() => setSelectedImage(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white p-2 bg-black/50 rounded-full transition-colors"
            onClick={(e) => { e.stopPropagation(); setSelectedImage(null); }}
          >
            <X size={24} />
          </button>
          <img
            src={selectedImage}
            alt="Zoomed feature"
            className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl scale-100 transition-transform duration-300"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
