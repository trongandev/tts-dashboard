import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Footer from './Footer';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, MapPin, LogOut } from 'lucide-react';
import { FindTimesheetByTeacher } from '../type-timesheet';
import { useUser } from '../contexts/UserContext';
import { RANKS } from '../data';

const getCookie = (name: string) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return null;
};

export default function Timesheet() {
  const { user, setUser } = useUser();
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filterUnchecked, setFilterUnchecked] = useState(false);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string | null>(null);
  const [selectedRankId, setSelectedRankId] = useState<string>(() => {
    return localStorage.getItem('selectedRankId') || 'T0';
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    const saved = localStorage.getItem('isSidebarOpen');
    return saved !== null ? JSON.parse(saved) : true;
  });

  const toggleSidebar = (isOpen: boolean) => {
    setIsSidebarOpen(isOpen);
    localStorage.setItem('isSidebarOpen', JSON.stringify(isOpen));
  };

  const handleRankChange = (val: string) => {
    setSelectedRankId(val);
    localStorage.setItem('selectedRankId', val);
  };

  const { data: timesheetData = [], isLoading: loading, error: queryError } = useQuery<FindTimesheetByTeacher[]>({
    queryKey: ['timesheet', currentDate.getFullYear(), currentDate.getMonth(), user?.id],
    queryFn: async () => {
      if (!user) return [];

      let token = getCookie('accessToken');
      if (!token) token = getCookie('idToken');
      if (!token) throw new Error('Không tìm thấy token xác thực.');

      const authHeader = token.startsWith('Bearer ') ? token : `Bearer ${token}`;

      const now = new Date();
      const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59, 999);

      const response = await fetch(`${import.meta.env.VITE_API_ENDPOINT}/api/timesheet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify({
          teacherId: user.id,
          startDate: firstDay.getTime().toString(),
          endDate: lastDay.getTime().toString()
        })
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`Lỗi ${response.status}: ${errText || response.statusText}`);
      }

      const data = await response.json();

      let timesheetItems: FindTimesheetByTeacher[] = [];
      if (data?.findTimesheetByTeacher) {
        timesheetItems = data.findTimesheetByTeacher;
      } else if (data?.data?.findTimesheetByTeacher) {
        timesheetItems = data.data.findTimesheetByTeacher;
      }

      timesheetItems.sort((a, b) => {
        const timeA = a.classSessionAttendance?.startTime ? Number(a.classSessionAttendance.startTime) : Number(a.date);
        const timeB = b.classSessionAttendance?.startTime ? Number(b.classSessionAttendance.startTime) : Number(b.date);
        return timeA - timeB;
      });

      return timesheetItems;
    },
    enabled: !!user,
  });

  const error = queryError ? queryError.message : null;

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const formatTime = (timeMsStr: string | number) => {
    if (!timeMsStr) return '';
    const date = new Date(Number(timeMsStr));
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  const monthYearLabel = currentDate.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });
  const shortMonthYearLabel = `T${currentDate.getMonth() + 1}/${currentDate.getFullYear()}`;

  // Group timesheet by date
  const selectedRank = RANKS.find(r => r.id === selectedRankId) || RANKS[0];
  const rankRate = selectedRank.rate;
  const nowMs = Date.now();

  const getDisplayType = (item: FindTimesheetByTeacher): string => {
    if (item.type === 'ATTENDANCE_CLASS') return 'LỚP HỌC';
    if (item.type === 'OFFICE_HOUR' && item.officeHour?.type) {
      const ohType = item.officeHour.type.toUpperCase();
      if (ohType.includes('TRIAL')) return 'TRẢI NGHIỆM ONL';
      if (ohType.includes('FIXED')) return 'TRỰC OFFLINE';
      if (ohType.includes('MAKEUP') || ohType.includes('DẠY BÙ')) return 'DẠY BÙ';
      if (ohType.includes('SUPPLY') || ohType.includes('DẠY THAY')) return 'DẠY THAY';
      if (ohType === 'TA' || ohType === 'TRỢ GIẢNG') return 'TRỢ GIẢNG';
      return ohType;
    }
    return item.type || 'KHÁC';
  };

  const processedData = timesheetData.map(item => {
    let itemSalary = 0;
    let hours = 2;

    if (item.type === 'ATTENDANCE_CLASS') {
      itemSalary = rankRate * 2;
    } else if (item.type === 'OFFICE_HOUR' && item.officeHour) {
      const ohType = item.officeHour.type || '';
      const studentCount = item.officeHour.studentCount || 0;

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

    const itemDate = Number(item.date);
    const isFuture = itemDate > nowMs;
    const displayStatus = (isFuture && item.status !== 'CHECKED') ? 'NOT_STARTED' : item.status;
    const displayType = getDisplayType(item);

    return { ...item, itemSalary, displayStatus, displayType };
  });

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    processedData.forEach(item => {
      if (filterUnchecked && item.displayStatus !== 'UNCHECKED') return;
      const t = item.displayType;
      counts[t] = (counts[t] || 0) + 1;
    });
    return counts;
  }, [processedData, filterUnchecked]);

  const filteredData = processedData.filter(item => {
    if (filterUnchecked && item.displayStatus !== 'UNCHECKED') return false;
    if (selectedTypeFilter && item.displayType !== selectedTypeFilter) return false;
    return true;
  });
  const groupedData: Record<string, typeof processedData[0][]> = {};
  filteredData.forEach(item => {
    const timeMs = item.classSessionAttendance?.startTime || item.date;
    if (timeMs) {
      const dateObj = new Date(Number(timeMs));
      const dateStr = dateObj.toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit' });
      if (!groupedData[dateStr]) groupedData[dateStr] = [];
      groupedData[dateStr].push(item);
    }
  });

  // Stats
  const formatCurrency = (val: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);

  const uniqueClasses = new Set<string>();
  let checkedCount = 0;
  let uncheckedCount = 0;
  let totalSalary = 0;

  processedData.forEach(item => {
    if (item.classSessionAttendance?.class?.id) {
      uniqueClasses.add(item.classSessionAttendance.class.id);
    }

    if (item.displayStatus === 'UNCHECKED') {
      uncheckedCount++;
    } else if (item.displayStatus === 'CHECKED') {
      checkedCount++;
      totalSalary += item.itemSalary;
    }
  });

  const getInitials = (name?: string) => {
    if (!name || name === 'Người dùng') return 'U';
    const parts = name.split(' ').filter(p => p.length > 0);
    if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };
  const displayName = user?.displayName || user?.username || 'Người dùng';

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
      <main className="flex-1 flex flex-col overflow-hidden">

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

        <div className="flex-1 flex overflow-hidden relative">
          {/* Mobile Overlay */}
          <div
            className={`md:hidden absolute inset-0 bg-slate-900/20 z-30 transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}
            onClick={() => toggleSidebar(false)}
          />

          {/* Quick Nav Sidebar */}
          <div className={`absolute md:relative h-full flex flex-col shrink-0 overflow-y-auto z-40 md:z-10 bg-white border-r border-slate-200 transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-[80%] md:w-64 lg:w-72 translate-x-0' : 'w-0 -translate-x-full opacity-0'}`}>
            <div className="w-[80vw] md:w-64 lg:w-72 flex flex-col min-h-full">
              {Object.keys(groupedData).length > 0 && (
                <>
                  <div className="p-5 border-b border-slate-100 sticky top-0 bg-white/90 backdrop-blur z-10 flex justify-between items-center">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center">
                      <CalendarIcon size={16} className="mr-2 text-slate-400" />
                      Danh sách ngày
                    </h3>
                    <button onClick={() => toggleSidebar(false)} className="text-slate-400 hover:text-slate-600 transition-colors bg-slate-100 hover:bg-slate-200 p-1.5 rounded-md shrink-0">
                      <ChevronLeft size={16} />
                    </button>
                  </div>
                  <div className="p-3 space-y-1">
                    {Object.keys(groupedData).map(dateLabel => {
                      const hasUnchecked = groupedData[dateLabel].some(item => item.displayStatus === 'UNCHECKED');
                      return (
                        <button
                          key={dateLabel}
                          onClick={() => {
                            const el = document.getElementById(`date-${dateLabel.replace(/\s+/g, '-')}`);
                            if (el) {
                              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }
                            toggleSidebar(false);
                          }}
                          className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-between group ${hasUnchecked ? 'bg-orange-50 text-orange-700 hover:bg-orange-100' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                        >
                          <span className="truncate mr-2 capitalize">{dateLabel}</span>
                          {hasUnchecked && <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0  relative">
                            <div className="absolute inset-0 rounded-full bg-orange-700/50 animate-ping"></div>
                          </span>}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto scroll-smooth relative" onScroll={handleScroll}>
            {!isSidebarOpen && (
              <button
                onClick={() => toggleSidebar(true)}
                className="hidden md:flex sticky left-0 top-1/2 -translate-y-1/2 z-20 bg-white border border-slate-200 border-l-0 rounded-r-xl p-2 shadow-sm text-slate-400 hover:text-orange-500 transition-colors"
                title="Mở danh sách ngày"
              >
                <ChevronRight size={20} />
              </button>
            )}
            <div className="max-w-6xl mx-auto space-y-6 p-4 md:p-6 lg:p-8 pb-20 md:pb-8 ">

              {/* Top Summary Cards */}
              <section className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6 shrink-0">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase">Lương (đã chốt)</p>
                    <h2 className="text-2xl font-bold text-burgundy mt-1">{formatCurrency(totalSalary)}</h2>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase">Số lớp tham gia</p>
                    <h2 className="text-2xl font-bold text-slate-800 mt-1">{uniqueClasses.size} <span className="text-sm font-normal text-slate-400 leading-none">Lớp</span></h2>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase">Công đã chốt</p>
                    <h2 className="text-2xl font-bold text-green-600 mt-1">{checkedCount} <span className="text-sm font-normal text-slate-400 leading-none">Buổi</span></h2>
                  </div>
                </div>

                <div
                  className={`relative bg-white p-6 rounded-2xl shadow-sm border flex flex-col justify-between cursor-pointer transition-colors ${filterUnchecked ? 'ring-2 ring-orange-500 border-orange-500' : 'border-slate-100 hover:border-orange-200'}`}
                  onClick={() => setFilterUnchecked(!filterUnchecked)}
                >
                  {uncheckedCount > 0 && !filterUnchecked && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-orange-500 border-2 border-white"></span>
                    </span>
                  )}
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase">Công chưa chốt</p>
                    <h2 className="text-2xl font-bold text-orange-500 mt-1">{uncheckedCount} <span className="text-sm font-normal text-slate-400 leading-none">Buổi</span></h2>
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

              <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm sticky top-2 md:top-4 z-20">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-burgundy/10 text-burgundy rounded-xl flex items-center justify-center">
                    <CalendarIcon size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 capitalize">
                      <span className="md:hidden">{shortMonthYearLabel}</span>
                      <span className="hidden md:inline">{monthYearLabel}</span>
                    </h3>
                    <p className="text-sm text-slate-500">
                      <span className="md:hidden">Lịch giảng dạy</span>
                      <span className="hidden md:inline">Lịch trình giảng dạy trong tháng</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={prevMonth}
                    className="w-10 h-10 flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-burgundy transition-colors"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button
                    onClick={() => setCurrentDate(new Date())}
                    className="px-4 h-10 flex items-center justify-center rounded-lg border border-slate-200 font-medium text-slate-700 hover:bg-slate-50 transition-colors text-sm"
                  >
                    Hôm nay
                  </button>
                  <button
                    onClick={nextMonth}
                    className="w-10 h-10 flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-burgundy transition-colors"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 text-sm">
                  <strong>Lỗi:</strong> {error}
                </div>
              )}

              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                  <div className="w-10 h-10 border-4 border-burgundy/20 border-t-burgundy rounded-full animate-spin"></div>
                  <p className="text-slate-500 font-medium">Đang tải lịch dạy...</p>
                </div>
              ) : Object.keys(groupedData).length === 0 && !error ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-12 flex flex-col items-center justify-center text-center shadow-sm">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-400">
                    <CalendarIcon size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 mb-2">Không có lịch dạy</h3>
                  <p className="text-slate-500 max-w-sm">Không tìm thấy buổi dạy nào trong tháng này. Thay đổi tháng để xem các lịch khác.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.keys(typeCounts).length > 0 && (
                    <div className="flex flex-wrap gap-2 sticky top-[110px] md:top-[100px] z-10 bg-[#F9FAFB] py-2">
                      <button
                        onClick={() => setSelectedTypeFilter(null)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${!selectedTypeFilter ? 'bg-burgundy text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
                      >
                        TẤT CẢ ({processedData.filter(i => !filterUnchecked || i.displayStatus === 'UNCHECKED').length})
                      </button>
                      {Object.entries(typeCounts).map(([type, count]) => (
                        <button
                          key={type}
                          onClick={() => setSelectedTypeFilter(type === selectedTypeFilter ? null : type)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center ${selectedTypeFilter === type ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
                        >
                          {type}
                          <span className={`ml-1.5 px-1.5 py-0.5 rounded-md text-[10px] ${selectedTypeFilter === type ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                            {count}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="space-y-8">
                    {Object.entries(groupedData).map(([dateLabel, items]) => (
                      <div key={dateLabel} className="space-y-4">
                        <h4
                          id={`date-${dateLabel.replace(/\s+/g, '-')}`}
                          onClick={() => toggleSidebar(!isSidebarOpen)}
                          className={`text-md font-bold sticky top-[150px] md:top-[140px] py-2 bg-[#F9FAFB] z-10 border-b border-slate-200/50 capitalize flex items-center cursor-pointer hover:text-burgundy transition-colors ${items.some(i => i.displayStatus === 'UNCHECKED') ? 'text-orange-600' : 'text-slate-800'}`}
                        >
                          {dateLabel}
                          {items.some(i => i.displayStatus === 'UNCHECKED') && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 normal-case">
                              <span className="w-1.5 h-1.5 bg-orange-500 rounded-full mr-1.5"></span>
                              Có ca chưa chốt
                            </span>
                          )}
                        </h4>
                        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
                          {items.map((item) => (
                            <div key={item.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                              <div className="flex justify-between items-start mb-3">
                                <div className="flex gap-2">
                                  <span className="inline-block px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg uppercase tracking-wide">
                                    {item.displayType}
                                  </span>
                                  {item.itemSalary > 0 && (
                                    <span className="inline-block px-3 py-1 bg-green-50 text-green-700 text-xs font-bold rounded-lg">
                                      +{formatCurrency(item.itemSalary)}
                                    </span>
                                  )}
                                </div>
                                {item.displayStatus === 'CHECKED' && (
                                  <span className="inline-block px-2 py-1 bg-green-50 text-green-700 text-xs font-bold rounded-lg capitalize shrink-0 ml-2">
                                    Đã chốt
                                  </span>
                                )}
                                {item.displayStatus === 'UNCHECKED' && (
                                  <span className="inline-block px-2 py-1 bg-orange-50 text-orange-700 text-xs font-bold rounded-lg capitalize shrink-0 ml-2">
                                    Chưa chốt
                                  </span>
                                )}
                                {item.displayStatus === 'NOT_STARTED' && (
                                  <span className="inline-block px-2 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg capitalize shrink-0 ml-2">
                                    Chưa bắt đầu
                                  </span>
                                )}
                              </div>

                              <h5 className="text-xl font-extrabold text-slate-800 mb-4 whitespace-nowrap overflow-hidden text-ellipsis">
                                {item.type === 'ATTENDANCE_CLASS'
                                  ? (item.classSessionAttendance?.class?.name || 'Không có tên lớp')
                                  : (item.officeHour?.courses?.map(c => c.shortName).join(', ') || item.officeHour?.type || 'Không có tên lớp')
                                }
                              </h5>

                              <div className="space-y-2.5">
                                <div className="flex items-center text-slate-600 text-sm">
                                  <Clock size={16} className="text-slate-400 mr-2 shrink-0" />
                                  <span className="font-medium">
                                    {formatTime(item.type === 'ATTENDANCE_CLASS' ? item.classSessionAttendance?.startTime || '' : item.officeHour?.startTime || '')}
                                    {' '} - {' '}
                                    {formatTime(item.type === 'ATTENDANCE_CLASS' ? item.classSessionAttendance?.endTime || '' : item.officeHour?.endTime || '')}
                                  </span>
                                  <span className="ml-2 text-slate-400">
                                    ({item.type === 'ATTENDANCE_CLASS'
                                      ? (item.classSessionAttendance?.sessionHour ? `${item.classSessionAttendance.sessionHour} giờ` : 'N/A')
                                      : (() => {
                                        if (item.officeHour?.startTime && item.officeHour?.endTime) {
                                          const start = Number(item.officeHour.startTime);
                                          const end = Number(item.officeHour.endTime);
                                          if (!isNaN(start) && !isNaN(end)) return `${(end - start) / 3600000} giờ`;
                                        }
                                        return 'N/A';
                                      })()
                                    })
                                  </span>
                                </div>

                                {(item.centre?.name || item.classSessionAttendance?.status === 'ATTENDED') && (
                                  <div className="flex items-center text-slate-600 text-sm">
                                    <MapPin size={16} className="text-slate-400 mr-2 shrink-0" />
                                    <span>
                                      {item.centre?.name ? item.centre.name : 'Vị trí chưa cập nhật'}
                                      {item.classSessionAttendance?.status === 'ATTENDED' && (
                                        <span className="ml-2 text-green-600 font-medium">(Đã điểm danh)</span>
                                      )}
                                      {item.classSessionAttendance?.status === 'LATE_ARRIVED' && (
                                        <span className="ml-2 text-orange-600 font-medium">(Đến trễ)</span>
                                      )}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <Footer />
          </div>
        </div>
      </main>
    </div>
  );
}
