import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import ClassCard from './ClassCard';
import ClassDetailsModal from './ClassDetailsModal';
import Footer from './Footer';
import { RANKS } from '../data';
import { ClassInfo, Rank } from '../types';
import { FindTimesheetByTeacher } from '../type-timesheet';
import { ChevronDown, Wallet, BookOpen, Clock, LogOut } from 'lucide-react';
import { useUser } from '../contexts/UserContext';

const getCookie = (name: string) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return null;
};

export default function Dashboard() {
  const { user, setUser } = useUser();
  const navigate = useNavigate();
  const [selectedRankId, setSelectedRankId] = useState<string>('T5');
  const [selectedClass, setSelectedClass] = useState<ClassInfo | null>(null);
  const { data: classes = [], isLoading: loading, error: queryError } = useQuery<ClassInfo[]>({
    queryKey: ['classes', user?.id],
    queryFn: async () => {
      if (!user) return [];

      let token = getCookie('accessToken');
      if (!token) token = getCookie('idToken');
      if (!token) throw new Error('Không tìm thấy token xác thực, vui lòng đăng nhập lại.');

      const authHeader = token.startsWith('Bearer ') ? token : `Bearer ${token}`;

      const response = await fetch(`${import.meta.env.VITE_API_ENDPOINT}/api/classes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify({ teacherId: user.id, pageIndex: 0, itemsPerPage: 20, orderBy: "createdAt_desc" })
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status} - ${errText || response.statusText}`);
      }

      const data = await response.json();

      let rawClasses = [];
      if (data?.data?.classes?.data) {
        rawClasses = data.data.classes.data;
      } else if (data?.classes?.data) {
        rawClasses = data.classes.data;
      }

      if (rawClasses && Array.isArray(rawClasses)) {
        return rawClasses.map((d: any) => {
          let completedHours = 0;
          let nextSessionStr = 'Chưa có lịch';

          if (d.slots && d.slots.length > 0) {
            const now = new Date();
            const pastSlots = d.slots.filter((s: any) => new Date(s.date) < now);
            completedHours = pastSlots.reduce((acc: number, cur: any) => acc + (cur.sessionHour || 0), 0);

            const futureSlots = d.slots.filter((s: any) => new Date(s.date) >= now).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
            if (futureSlots.length > 0) {
              const next = futureSlots[0];
              const dateObj = new Date(next.date);
              if (!isNaN(dateObj.getTime())) {
                const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

                const formatTime = (timeVal: string | number) => {
                  if (!timeVal) return '';
                  const d = new Date(typeof timeVal === 'number' || (typeof timeVal === 'string' && !isNaN(Number(timeVal))) ? Number(timeVal) : timeVal);
                  if (isNaN(d.getTime())) return String(timeVal); // fallback
                  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
                };

                const startStr = formatTime(next.startTime);
                const endStr = formatTime(next.endTime);
                const dayStr = dateObj.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

                nextSessionStr = `${days[dateObj.getDay()]}, ${dayStr} | ${startStr} - ${endStr}`;
              }
            }
          }

          let status: ClassInfo['status'] = 'RUNNING';
          const rawStatus = (d.status || '').toUpperCase();
          if (['COMPLETED', 'CLOSED', 'DONE', 'FINISHED'].includes(rawStatus)) {
            status = 'FINISHED';
          } else if (['PENDING', 'DRAFT', 'NEW', 'OPEN'].includes(rawStatus)) {
            status = 'OPEN';
          }

          const totalHours = d.totalHour || (d.numberOfSessions * d.sessionHour) || 0;

          return {
            id: d.id || d._id || Math.random().toString(),
            code: d.name || 'UNKNOWN',
            name: d.course?.name || d.name || 'Chưa cập nhật',
            students: d.students?.length || 0,
            totalHours: totalHours,
            completedHours: completedHours,
            nextSession: nextSessionStr,
            room: d.centre?.name || 'Online',
            status: status
          };
        });
      }
      return [];
    },
    enabled: !!user,
  });

  const fetchError = queryError ? queryError.message : null;

  const { data: timesheetData = [] } = useQuery<FindTimesheetByTeacher[]>({
    queryKey: ['timesheet', 'dashboard', user?.id],
    queryFn: async () => {
      if (!user) return [];

      let token = getCookie('accessToken');
      if (!token) token = getCookie('idToken');
      if (!token) throw new Error('Không tìm thấy token xác thực.');

      const authHeader = token.startsWith('Bearer ') ? token : `Bearer ${token}`;

      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const response = await fetch(`${import.meta.env.VITE_API_ENDPOINT}/api/timesheet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify({
          teacherId: user.id,
          startDate: firstDay.getTime().toString(),
          endDate: lastDay.getTime().toString(),
          type: "ATTENDANCE_CLASS",
          classSessionStatusNotIn: ["ATTENDED"]
        })
      });

      if (!response.ok) {
        throw new Error('Lỗi tải timesheet');
      }

      const data = await response.json();
      if (data?.findTimesheetByTeacher) return data.findTimesheetByTeacher;
      if (data?.data?.findTimesheetByTeacher) return data.data.findTimesheetByTeacher;
      return [];
    },
    enabled: !!user,
  });

  const selectedRank = RANKS.find(r => r.id === selectedRankId) || RANKS[0];
  const displayName = user?.displayName || user?.username || 'Người dùng';

  const formatCurrency = (val: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);

  const uniqueClasses = new Set();
  let currentSalary = 0;
  let expectedSalary = 0;

  timesheetData.forEach(item => {
    if (item.classSessionAttendance?.class?.id) {
      uniqueClasses.add(item.classSessionAttendance.class.id);
    }

    let itemSalary = 0;
    const rankRate = selectedRank.rate;

    if (item.type === 'ATTENDANCE_CLASS') {
      itemSalary = rankRate * 2;
    } else if (item.type === 'OFFICE_HOUR' && item.officeHour) {
      const ohType = item.officeHour.type || '';
      const studentCount = item.officeHour.studentCount || 0;

      let hours = 2;
      if (item.officeHour.startTime && item.officeHour.endTime) {
        const start = Number(item.officeHour.startTime);
        const end = Number(item.officeHour.endTime);
        if (!isNaN(start) && !isNaN(end)) {
          hours = (end - start) / 3600000;
        }
      }

      const typeLower = ohType.toLowerCase();

      if (typeLower === 'ta') {
        itemSalary = 0.75 * rankRate * hours;
      } else if (typeLower === 'makeup' || typeLower === 'dạy bù') {
        itemSalary = studentCount <= 3 ? (0.75 * rankRate * hours) : (1.0 * rankRate * hours);
      } else if (typeLower.includes('trial') || typeLower.includes('trải nghiệm')) {
        if (typeLower.includes('online')) {
          if (studentCount === 1) itemSalary = 40000;
          else if (studentCount === 2) itemSalary = 60000;
          else if (studentCount >= 3) itemSalary = 80000;
        } else {
          // Offline by default
          itemSalary = 80000 + (studentCount * 30000);
        }
      } else if (typeLower === 'workshop') {
        itemSalary = 1.0 * rankRate * hours;
      } else if (typeLower === 'event' || typeLower === 'sự kiện') {
        itemSalary = 1.0 * rankRate * 2;
      } else if (typeLower === 'main judge' || typeLower === 'bgk chính') {
        itemSalary = 1.0 * rankRate * 2;
      } else if (typeLower === 'sub judge' || typeLower === 'bgk phụ') {
        itemSalary = Math.min(1.0 * rankRate * 2, 300000);
      } else if (typeLower === 'lab' || typeLower === 'trực lab') {
        itemSalary = Math.min(1.0 * rankRate * 2, 200000);
      }
    }

    expectedSalary += itemSalary;

    if (item.status === 'CHECKED') {
      currentSalary += itemSalary;
    }
  });

  const totalClasses = classes.length;
  const totalStudents = classes.reduce((acc, curr) => acc + curr.students, 0);

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
  const handleRankChange = (val: string) => {
    setSelectedRankId(val);
    localStorage.setItem('selectedRankId', val);
  };
  return (
    <div className="flex h-screen overflow-hidden bg-[#F9FAFB]">
      <Sidebar />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col bg-[#F9FAFB] overflow-hidden">

        {/* Mobile Top Navigation (Hides on Scroll) */}
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

          <div className="max-w-7xl mx-auto space-y-6">
            {/* Top Summary Cards */}
            <section className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4 md:gap-6 shrink-0">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase">Tổng lương hiện tại</p>
                  <h2 className="text-3xl font-bold text-burgundy mt-1">{formatCurrency(currentSalary)}</h2>
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase">Tổng lương dự kiến</p>
                  <h2 className="text-3xl font-bold text-burgundy mt-1">{formatCurrency(expectedSalary)}</h2>
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase">Số lớp đang dạy</p>
                  <h2 className="text-3xl font-bold text-slate-800 mt-1">{classes.filter(c => c.status !== 'FINISHED').length} <span className="text-lg font-normal text-slate-400 leading-none">Lớp</span></h2>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase">Tổng số học viên</p>
                  <h2 className="text-3xl font-bold text-slate-800 mt-1">{totalStudents} <span className="text-lg font-normal text-slate-400 leading-none">Bạn</span></h2>
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase mb-1">RANK LƯƠNG HIỆN TẠI</p>
                  <select
                    value={selectedRankId}
                    onChange={(e) => handleRankChange(e.target.value)}
                    className="text-sm font-semibold bg-slate-50 md:bg-slate-50 border border-slate-200 md:border-none rounded-lg focus:ring-2 focus:ring-burgundy/20 py-2 px-3 pr-8 cursor-pointer w-full md:w-auto appearance-none text-left md:text-right outline-none"
                  >
                    {RANKS.map(rank => (
                      <option key={rank.id} value={rank.id}>
                        {rank.id} - {formatCurrency(rank.rate)}/h
                      </option>
                    ))}
                  </select> </div>
              </div>
            </section>

            {/* Classes Section */}
            <div className="flex flex-col gap-8">
              {/* Active Classes */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold">Lớp đang giảng dạy {loading && <span className="text-sm font-normal text-slate-400 ml-2">(Đang tải...)</span>}</h3>
                  <button className="text-sm text-burgundy font-semibold hover:underline">
                    Xem tất cả
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {fetchError && (
                    <div className="col-span-full bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 text-sm mb-4">
                      <strong>Lỗi tải danh sách lớp:</strong> {fetchError}
                    </div>
                  )}
                  {!loading && !fetchError && classes.filter(c => c.status !== 'FINISHED').length === 0 && (
                    <div className="col-span-full text-center py-10 text-slate-500">
                      Không có lớp nào đang diễn ra
                    </div>
                  )}
                  {classes.filter(c => c.status !== 'FINISHED').map(cls => (
                    <ClassCard
                      key={cls.id}
                      classInfo={cls}
                      selectedRank={selectedRank}
                      onClick={(c) => setSelectedClass(c)}
                    />
                  ))}
                </div>
              </div>

              {/* Finished Classes */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold">Lớp đã hoàn thành</h3>
                </div>

                <div className="space-y-4 opacity-75  grid grid-cols-1 md:grid-cols-2  xl:grid-cols-3 gap-5">
                  {!loading && !fetchError && classes.filter(c => c.status === 'FINISHED').length === 0 && (
                    <div className="text-center py-10 text-slate-500 col-span-full">
                      Chưa có lớp nào hoàn thành
                    </div>
                  )}
                  {classes.filter(c => c.status === 'FINISHED').map(cls => (
                    <ClassCard
                      key={cls.id}
                      classInfo={cls}
                      selectedRank={selectedRank}
                      onClick={(c) => setSelectedClass(c)}
                    />
                  ))}
                </div>
              </div>
            </div>

            <Footer />
          </div>
        </div>
      </main>

      {/* Details Modal */}
      {selectedClass && (
        <ClassDetailsModal
          classInfo={selectedClass}
          selectedRank={selectedRank}
          onClose={() => setSelectedClass(null)}
        />
      )}
    </div>
  );
}
