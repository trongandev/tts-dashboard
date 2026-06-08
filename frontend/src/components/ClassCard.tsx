import React from 'react';
import { ClassInfo, Rank } from '../types';
import { Users, Clock, CalendarDays, MapPin } from 'lucide-react';

interface ClassCardProps {
  key?: React.Key;
  classInfo: ClassInfo;
  selectedRank: Rank;
  onClick: (cls: ClassInfo) => void;
}

export default function ClassCard({ classInfo, selectedRank, onClick }: ClassCardProps) {
  // Lương tạm tính dựa trên số giờ đã dạy * mức lương của rank
  const salary = classInfo.completedHours * selectedRank.rate;

  const formattedSalary = new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(salary);

  const getStatusBadge = (status: ClassInfo['status']) => {
    switch (status) {
      case 'OPEN':
        return <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider">ĐANG CHỜ</span>;
      case 'RUNNING':
        return <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider">ĐANG DIỄN RA</span>;
      case 'FINISHED':
        return <span className="bg-slate-100 text-slate-500 px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider">HOÀN THÀNH</span>;
    }
  };
  function extractCourseCode(headerText) {
    if (!headerText) {
      return "";
    }

    let parts = headerText.split(" ")[0].split("-");
    let length = parts.length;
    if (parts[1] === "AI4L1") {
      return "AI4L1";
    }

    if (parts[1] === "AI4L2") {
      return "AI4L2";
    }

    if (parts[1] === "AI4L2") {
      return "AI4L2";
    }

    if (length === 3 || length === 4) {
      return parts[2].replace(/\d/g, "");
    }

    if (length === 2) {
      return parts[1].replace(/\d/g, "");
    }

    return "";
  }

  return (
    <div
      onClick={() => onClick(classInfo)}
      className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 hover:border-burgundy/30 transition-all cursor-pointer group flex flex-col"
    >
      <div className="flex items-start justify-between">
        <div className="flex space-x-4">
          <div className="w-12 h-12 bg-burgundy/5 rounded-lg flex items-center justify-center text-burgundy font-bold text-sm shrink-0">
            {extractCourseCode(classInfo.code)}
          </div>
          <div>
            <h4 className="font-bold text-slate-800">{classInfo.code}</h4>
            <p className="text-xs text-slate-500 font-medium ">{classInfo.name}</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-burgundy">{formattedSalary}</p>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">Lương H.Tại</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-50 pt-4">
        <div className="flex space-x-4 text-xs font-medium text-slate-500">
          <span className="flex items-center gap-1"><Users size={12} /> {classInfo.students} HV</span>
          <span className="flex items-center gap-1"><Clock size={12} /> {classInfo.completedHours}/{classInfo.totalHours}h</span>
        </div>
        <div>
          {getStatusBadge(classInfo.status)}
        </div>
      </div>
    </div>
  );
}
