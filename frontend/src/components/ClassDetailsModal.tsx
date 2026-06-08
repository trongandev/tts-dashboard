import React from 'react';
import { X, Users, Clock, CalendarDays, MapPin } from 'lucide-react';
import { ClassInfo, Rank } from '../types';

interface ClassDetailsModalProps {
  classInfo: ClassInfo;
  selectedRank: Rank;
  onClose: () => void;
}

export default function ClassDetailsModal({ classInfo, selectedRank, onClose }: ClassDetailsModalProps) {
  const currentSalary = classInfo.completedHours * selectedRank.rate;
  const totalExpectedSalary = classInfo.totalHours * selectedRank.rate;

  const formatCurrency = (val: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  console.log(classInfo)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Chi tiết lớp học</h2>
            <p className="text-sm text-slate-500 mt-1">Mã lớp: <span className="font-semibold text-burgundy">{classInfo.code}</span></p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mb-8">
            <h3 className="text-2xl font-bold text-slate-800 mb-2">{classInfo.name}</h3>
            <div className="flex gap-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-burgundy/5 text-burgundy font-semibold text-sm rounded-lg">
                <Users size={16} /> {classInfo.students} Học viên
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-700 font-semibold text-sm rounded-lg">
                <MapPin size={16} /> {classInfo.room}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50">
              <p className="text-sm font-bold text-slate-400 uppercase mb-1">Tiến độ giảng dạy</p>
              <div className="flex items-end gap-2 text-slate-800">
                <span className="text-2xl font-bold">{classInfo.completedHours}</span>
                <span className="text-sm font-medium mb-1 text-slate-500">/ {classInfo.totalHours} giờ</span>
              </div>
              {/* Progress Bar */}
              <div className="w-full bg-slate-200 rounded-full h-2 mt-3">
                <div
                  className="bg-burgundy h-2 rounded-full"
                  style={{ width: `${(classInfo.completedHours / classInfo.totalHours) * 100}%` }}
                ></div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50">
              <p className="text-sm font-bold text-slate-400 uppercase mb-1">Buổi học tiếp theo</p>
              <div className="flex items-center gap-2 mt-2 text-slate-800 font-semibold">
                <CalendarDays size={20} className="text-burgundy" />
                {classInfo.nextSession}
              </div>
            </div>
          </div>

          <div className="border border-burgundy/20 bg-burgundy/5 rounded-xl p-5 mb-2">
            <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">Chi tiết lương</h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600">Bậc lương hiện tại</span>
                <span className="font-semibold text-slate-800">{selectedRank.name} {formatCurrency(selectedRank.rate)}/giờ</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600">Lương đã tích lũy ({classInfo.completedHours} giờ)</span>
                <span className="font-bold text-burgundy">{formatCurrency(currentSalary)}</span>
              </div>
              <div className="w-full h-px bg-burgundy/10 my-2"></div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-slate-700">Dự kiến tổng khóa học</span>
                <span className="font-bold text-slate-800">{formatCurrency(totalExpectedSalary)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl font-medium text-slate-700 hover:bg-slate-200 transition-colors"
          >
            Đóng
          </button>
          <button className="px-5 py-2.5 rounded-xl bg-burgundy text-white font-medium hover:bg-burgundy-hover transition-colors shadow-sm shadow-burgundy/20">
            Xem danh sách lớp
          </button>
        </div>
      </div>
    </div>
  );
}
