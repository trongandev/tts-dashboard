import React from 'react';

export default function Footer() {
  return (
    <footer className="mt-8 pt-6 pb-24 md:pb-6 border-t border-slate-200 text-center space-y-2">
      <p className="text-sm text-slate-500">
        Tác giả: <strong className="text-slate-700">Nguyễn Trọng An</strong>
      </p>
      <p className="text-sm text-slate-500">
        Github: <a href="https://github.com/trongandev" target="_blank" rel="noopener noreferrer" className="text-burgundy hover:underline font-medium">trongandev</a>
      </p>
      <p className="text-sm text-slate-500">
        Email hỗ trợ / Khiếu nại bản quyền: <a href="mailto:trongandev@gmail.com" className="text-burgundy hover:underline font-medium">trongandev@gmail.com</a>
      </p>
      <p className="text-xs text-slate-400 max-w-2xl mx-auto mt-4 leading-relaxed">
        Sản phẩm này phục vụ với mục đích giúp đỡ mentor MindX kiểm tra công lương của mình rõ ràng hơn. Sản phẩm có sử dụng API chính chủ từ phía MindX mà không xin phép. Nếu có bất kỳ sai phạm hay vi phạm bản quyền vui lòng gửi mail cho tác giả.
      </p>
    </footer>
  );
}
