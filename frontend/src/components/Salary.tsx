import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Sidebar from './Sidebar';
import Footer from './Footer';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { DollarSign, Save, Loader2, TrendingUp, Calendar, CheckSquare, Undo2, RefreshCw, AlertTriangle, X, Info } from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { RANKS } from '../data';

const getCookie = (name: string) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return null;
};

export default function Salary() {
  const { user } = useUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year' | 'all' | 'custom'>(() => {
    return (localStorage.getItem('salaryPeriod') as any) || 'all';
  });

  const [showHowTo, setShowHowTo] = useState(false);

  useEffect(() => {
    const hasSeen = localStorage.getItem('hasSeenSalaryHowTo');
    if (!hasSeen) {
      setShowHowTo(true);
    }
  }, []);

  const handleCloseHowTo = () => {
    localStorage.setItem('hasSeenSalaryHowTo', 'true');
    setShowHowTo(false);
  };

  // States for Rank Assignment and Filtering UI
  const [fromMonth, setFromMonth] = useState(new Date().getMonth() + 1);
  const [fromYear, setFromYear] = useState(new Date().getFullYear());
  const [toMonth, setToMonth] = useState(new Date().getMonth() + 1);
  const [toYear, setToYear] = useState(new Date().getFullYear());
  const [selectedRank, setSelectedRank] = useState(() => localStorage.getItem('selectedRankId') || 'T0');
  const [clickStep, setClickStep] = useState(0); // 0 = set from, 1 = set to
  const [showRefreshConfirm, setShowRefreshConfirm] = useState(false);
  const [showFutureWarning, setShowFutureWarning] = useState(false);
  const [showConfirmSaveRank, setShowConfirmSaveRank] = useState(false);
  const [autoShowPopup, setAutoShowPopup] = useState(() => localStorage.getItem('autoShowSalaryPopup') !== 'false');
  const [neverShowFutureWarning, setNeverShowFutureWarning] = useState(() => localStorage.getItem('hideFutureSalaryWarning') === 'true');

  const handlePeriodChange = (newPeriod: 'month' | 'all') => {
    setPeriod(newPeriod);
    localStorage.setItem('salaryPeriod', newPeriod);
  };


  const { data: salaryData, isLoading: loading, error: queryError } = useQuery({
    queryKey: ['salary', period, period === 'month' ? fromMonth : null, period === 'month' ? fromYear : null, user?.id],
    queryFn: async () => {
      if (!user) return null;
      let token = getCookie('accessToken') || getCookie('idToken');
      if (!token) throw new Error('Không tìm thấy token xác thực.');
      const authHeader = token.startsWith('Bearer ') ? token : `Bearer ${token}`;

      const bodyData: any = { teacherId: user.id, period };
      if (period === 'month') {
        bodyData.fromMonth = fromMonth;
        bodyData.fromYear = fromYear;
      }

      const response = await fetch(`${import.meta.env.VITE_API_ENDPOINT}/api/salary/calculate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify(bodyData)
      });

      if (!response.ok) {
        throw new Error(`Lỗi tải dữ liệu`);
      }
      return response.json();
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (period === 'all' && salaryData?.chartData?.length > 0) {
      const data = salaryData.chartData;
      const first = data[0];
      const last = data[data.length - 1];

      if (fromMonth !== first.month || fromYear !== first.year) {
        setFromMonth(first.month);
        setFromYear(first.year);
      }
      if (toMonth !== last.month || toYear !== last.year) {
        setToMonth(last.month);
        setToYear(last.year);
      }
    }
  }, [salaryData, period]);

  useEffect(() => {
    const now = new Date();
    let targetM = toMonth;
    let targetY = toYear;
    if (period === 'month') {
      targetM = fromMonth;
      targetY = fromYear;
    }

    if (targetY > now.getFullYear() || (targetY === now.getFullYear() && targetM > now.getMonth() + 1)) {
      if (!neverShowFutureWarning) {
        setShowFutureWarning(true);
      }
    }
  }, [fromMonth, fromYear, toMonth, toYear, period, neverShowFutureWarning]);

  const previousRanksRef = useRef<any[]>([]);

  const executeSaveRank = () => {
    // Record current state before saving to allow Undo
    const prev: any[] = [];
    if (salaryData?.chartData) {
      let curM = fromMonth;
      let curY = fromYear;
      let targetToM = period === 'month' ? fromMonth : toMonth;
      let targetToY = period === 'month' ? fromYear : toYear;
      while (curY < targetToY || (curY === targetToY && curM <= targetToM)) {
        const label = `Tháng ${curM}/${curY}`;
        const dataPoint = salaryData.chartData.find((d: any) => d.label === label);
        let rank = 'T0';
        if (dataPoint && dataPoint.rank) {
          const match = dataPoint.rank.match(/T\d/);
          if (match) rank = match[0];
        }
        prev.push({ month: curM, year: curY, rankId: rank });

        curM++;
        if (curM > 12) { curM = 1; curY++; }
      }
    }
    previousRanksRef.current = prev;
    saveRankMutation.mutate();
    setShowConfirmSaveRank(false);
  };

  const handleSaveRank = () => {
    setShowConfirmSaveRank(true);
  };

  const undoMutation = useMutation({
    mutationFn: async () => {
      let token = getCookie('accessToken') || getCookie('idToken');
      const authHeader = token?.startsWith('Bearer ') ? token : `Bearer ${token}`;
      const response = await fetch(`${import.meta.env.VITE_API_ENDPOINT}/api/salary/rank`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader || ''
        },
        body: JSON.stringify({
          teacherId: user?.id,
          updates: previousRanksRef.current
        })
      });
      if (!response.ok) throw new Error('Lỗi khi hoàn tác');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salary'] });
      toast.success('Đã hoàn tác khôi phục rank cũ!');
    },
    onError: (err) => {
      toast.error('Lỗi hoàn tác: ' + err.message);
    }
  });

  const refreshCacheMutation = useMutation({
    mutationFn: async () => {
      let token = getCookie('accessToken') || getCookie('idToken');
      const authHeader = token?.startsWith('Bearer ') ? token : `Bearer ${token}`;
      const bodyData: any = { teacherId: user?.id, period, forceRefresh: true };
      if (period === 'month') {
        bodyData.fromMonth = fromMonth;
        bodyData.fromYear = fromYear;
      }

      const res = await fetch(`${import.meta.env.VITE_API_ENDPOINT}/api/salary/calculate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader || ''
        },
        body: JSON.stringify(bodyData)
      });
      if (!res.ok) throw new Error('Failed to refresh cache');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['salary'] });
      toast.success('Đã làm mới dữ liệu và xóa cache!');
    },
    onError: (err) => {
      toast.error('Lỗi: ' + err.message);
    }
  });

  const saveRankMutation = useMutation({
    mutationFn: async () => {
      let token = getCookie('accessToken') || getCookie('idToken');
      const authHeader = token?.startsWith('Bearer ') ? token : `Bearer ${token}`;
      const response = await fetch(`${import.meta.env.VITE_API_ENDPOINT}/api/salary/rank`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader || ''
        },
        body: JSON.stringify({
          teacherId: user?.id,
          fromMonth,
          fromYear,
          toMonth: period === 'month' ? fromMonth : toMonth,
          toYear: period === 'month' ? fromYear : toYear,
          rankId: selectedRank
        })
      });
      if (!response.ok) throw new Error('Lỗi khi lưu rank');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salary'] });

      const successText = period === 'month'
        ? `Đã cập nhật thành công T${fromMonth}/${fromYear} thành rank ${selectedRank}`
        : `Đã cập nhật thành công T${fromMonth}/${fromYear} ~ T${toMonth}/${toYear} thành rank ${selectedRank}`;

      toast((t) => (
        <div className="flex items-center gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <CheckSquare size={20} className="text-green-500" />
              <span className="font-semibold text-slate-800">Lưu thành công!</span>
            </div>
            <span className="text-sm text-slate-600">{successText}</span>
          </div>
          <button
            onClick={() => {
              toast.dismiss(t.id);
              undoMutation.mutate();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 hover:text-burgundy rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors"
          >
            <Undo2 size={14} /> Hoàn tác
          </button>
        </div>
      ), { duration: 6000, style: { padding: '12px 16px', borderRadius: '12px', maxWidth: '400px' } });
    },
    onError: (err) => {
      toast.error('Lỗi: ' + err.message);
    }
  });

  const formatCurrency = (val: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val || 0);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-4 border border-slate-200 shadow-xl rounded-xl z-50">
          <p className="font-bold text-slate-800 mb-2">
            {label}
          </p>
          {data.description && (
            <p className="text-slate-600 text-sm mb-2 italic">
              Chi tiết: {data.description}
            </p>
          )}
          <p className="text-burgundy font-semibold">
            Lương: {formatCurrency(payload[0].value)}
          </p>
          {data.rank && (
            <p className="text-slate-500 text-sm mt-1">
              Rank: {data.rank}
            </p>
          )}
          {period !== 'month' && <p className="text-xs text-slate-400 mt-2 italic">Click để chọn tháng này</p>}
        </div>
      );
    }
    return null;
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 9 }, (_, i) => currentYear - 8 + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const handleChartClick = (e: any) => {
    let labelToParse = '';

    // Sometimes recharts passes activeLabel directly or inside activePayload
    if (e && e.activeLabel) {
      labelToParse = e.activeLabel;
    } else if (e && e.activePayload && e.activePayload.length > 0) {
      labelToParse = e.activePayload[0].payload?.label || '';
    }

    if (!labelToParse) {
      // User might have clicked on a blank area where there is no data point
      return;
    }

    const match = labelToParse.match(/Tháng\s+(\d+)\/(\d+)/i);
    if (match) {
      const m = Number(match[1]);
      const y = Number(match[2]);

      if (clickStep === 0) {
        setFromMonth(m);
        setFromYear(y);
        setClickStep(1);
        toast.success(`Đã chọn BẮT ĐẦU từ tháng ${m}/${y}. Vui lòng click chọn thêm tháng KẾT THÚC.`, { id: 'click-step' });
      } else {
        setToMonth(m);
        setToYear(y);
        setClickStep(0);
        if (autoShowPopup) {
          // Delay lightly to ensure state is set before modal reads it
          setTimeout(() => setShowConfirmSaveRank(true), 0);
        } else {
          toast.success(`Đã chọn khoảng từ ${fromMonth}/${fromYear} đến ${m}/${y}. Vui lòng chọn Rank và bấm Lưu!`, { id: 'click-step' });
        }
      }
    } else {
      console.log('Cannot parse label:', labelToParse);
    }
  };

  return (
    <div>
      <div className="flex h-screen overflow-hidden bg-[#F9FAFB]">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 pb-20 scroll-smooth">
            <div className="max-w-6xl mx-auto space-y-6">

              {/* Header Section */}
              <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-6 rounded-2xl border border-slate-200 shadow-sm gap-4">
                <div className="flex items-center space-x-4">
                  <div className="w-14 h-14 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center shadow-inner">
                    <TrendingUp size={28} />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-slate-800 ">
                      Thống kê Công Lương

                    </h1>
                    <p className="text-sm text-slate-500">Biểu đồ chi tiết thu nhập & cài đặt hệ số lương</p>
                  </div>
                </div>

                {/* Period Tabs */}
                <div className="flex bg-slate-100 p-1.5 rounded-xl self-start md:self-auto overflow-x-auto max-w-full">
                  {[
                    { id: 'month', label: 'Tháng' },
                    { id: 'all', label: 'Tất cả' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => handlePeriodChange(tab.id as any)}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${period === tab.id
                        ? 'bg-white text-burgundy shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setShowRefreshConfirm(true)}
                  disabled={refreshCacheMutation.isPending}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-600 hover:text-burgundy hover:border-burgundy rounded-lg text-sm font-semibold flex items-center transition-all shadow-sm disabled:opacity-50"
                >
                  <RefreshCw size={16} className={`mr-2 ${refreshCacheMutation.isPending ? 'animate-spin' : ''}`} />
                  Làm mới
                </button>
              </div>

              {/* Rank Assignment Section */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h2 className="text-lg font-bold text-slate-800 mb-2 flex items-center">
                  <CheckSquare className="mr-2 text-burgundy" size={20} />
                  Cài đặt Rank Lương
                </h2>
                <p className="text-sm text-slate-600 mb-4 bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                  <strong className="text-blue-700">Bước 1:</strong> Click trực tiếp vào biểu đồ để chọn nhanh từ tháng nào đến tháng nào. <br />
                  <strong className="text-blue-700">Bước 2:</strong> Chọn Rank tương ứng và bấm <strong className="text-burgundy">Lưu Rank</strong>.
                </p>

                <div className="flex flex-col md:flex-row flex-wrap items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="flex gap-4 p-3 bg-white border border-slate-200 rounded-xl shadow-sm w-full md:w-auto">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">{period === 'month' ? 'Tháng' : 'Từ Tháng'}</label>
                      <select
                        value={fromMonth}
                        onChange={e => setFromMonth(Number(e.target.value))}
                        className={`w-20 bg-slate-50 border ${clickStep === 0 ? 'border-burgundy ring-1 ring-burgundy' : 'border-slate-200'} rounded-lg px-2 py-2 text-sm font-semibold focus:ring-2 focus:ring-burgundy/20 outline-none transition-all`}
                      >
                        {months.map(m => <option key={m} value={m}>T{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Năm</label>
                      <select
                        value={fromYear}
                        onChange={e => setFromYear(Number(e.target.value))}
                        className="w-24 bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-sm font-semibold focus:ring-2 focus:ring-burgundy/20 outline-none"
                      >
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                  </div>

                  {period !== 'month' && (
                    <div className="flex gap-4 p-3 bg-white border border-slate-200 rounded-xl shadow-sm w-full md:w-auto">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Đến Tháng</label>
                        <select
                          value={toMonth}
                          onChange={e => setToMonth(Number(e.target.value))}
                          className={`w-20 bg-slate-50 border ${clickStep === 1 ? 'border-burgundy ring-1 ring-burgundy' : 'border-slate-200'} rounded-lg px-2 py-2 text-sm font-semibold focus:ring-2 focus:ring-burgundy/20 outline-none transition-all`}
                        >
                          {months.map(m => <option key={m} value={m}>T{m}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Năm</label>
                        <select
                          value={toYear}
                          onChange={e => setToYear(Number(e.target.value))}
                          className="w-24 bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-sm font-semibold focus:ring-2 focus:ring-burgundy/20 outline-none"
                        >
                          {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                      </div>
                    </div>
                  )}

                  <div className="ml-auto flex items-end gap-3 w-full md:w-auto mt-2 md:mt-0 pt-4 md:pt-0 border-t border-slate-200 md:border-none">
                    <div className="flex-1 md:flex-none">
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Bước 2: Chọn Rank Lương</label>
                      <select
                        value={selectedRank}
                        onChange={e => {
                          const val = e.target.value;
                          setSelectedRank(val);
                          localStorage.setItem('selectedRankId', val);
                        }}
                        className="w-full md:w-36 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-burgundy/20 outline-none"
                      >
                        {RANKS.map(rank => (
                          <option key={rank.id} value={rank.id}>
                            {rank.id} - {formatCurrency(rank.rate)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={handleSaveRank}
                      disabled={saveRankMutation.isPending || undoMutation.isPending}
                      className="bg-burgundy text-white px-5 py-2 rounded-lg font-semibold text-sm flex items-center shadow-md hover:bg-burgundy/90 transition-colors disabled:opacity-70 h-[38px] flex-shrink-0"
                    >
                      {saveRankMutation.isPending || undoMutation.isPending ? <Loader2 size={16} className="animate-spin mr-2" /> : <Save size={16} className="mr-2" />}
                      Lưu Rank
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-3">
                  *Việc bấm "Lưu Rank" sẽ lưu lại hệ số lương cho toàn bộ các tháng trong khoảng đã chọn.
                </p>
              </div>

              {/* Charts and Data */}
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 size={40} className="text-burgundy animate-spin mb-4" />
                  <p className="text-slate-500 font-medium">Đang tính toán và tải dữ liệu lương...</p>
                </div>
              ) : queryError ? (
                <div className="bg-red-50 text-red-600 p-6 rounded-2xl border border-red-100 text-center">
                  <p className="font-bold mb-1">Không thể tải dữ liệu</p>
                  <p className="text-sm">Vui lòng kiểm tra lại kết nối hoặc liên hệ admin. ({queryError.message})</p>
                </div>
              ) : salaryData ? (
                <div className="space-y-6">

                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-gradient-to-br from-burgundy to-red-900 p-6 rounded-2xl shadow-md text-white">
                      <p className="text-white/70 text-sm font-semibold uppercase mb-1">Tổng Lương ({period})</p>
                      <h3 className="text-3xl font-bold">{formatCurrency(salaryData.totalSalary || 0)}</h3>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                      <p className="text-slate-400 text-sm font-semibold uppercase mb-1">Số buổi dạy</p>
                      <h3 className="text-3xl font-bold text-slate-800">{salaryData.totalSessions || 0}</h3>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                      <p className="text-slate-400 text-sm font-semibold uppercase mb-1">Rank phổ biến</p>
                      <h3 className="text-3xl font-bold text-blue-600">{salaryData.mostUsedRank || 'N/A'}</h3>
                    </div>
                  </div>

                  {/* Main Chart */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                      <div>
                        <h3 className="text-lg font-bold text-slate-800">Biểu đồ tăng trưởng lương</h3>
                        {period === 'all' && (
                          <p className="text-xs text-slate-500 mt-1 italic">
                            💡 Mẹo: Nhấp vào 2 điểm bất kỳ trên biểu đồ để chọn nhanh khoảng thời gian cấu hình Rank!
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => setShowHowTo(true)}
                        className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors border border-blue-100"
                      >
                        <Info size={16} />
                        Hướng dẫn
                      </button>
                    </div>
                    <div className="h-80 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        {period === 'month' ? (
                          <BarChart data={salaryData.chartData || []} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                            <XAxis
                              dataKey="label"
                              axisLine={false}
                              tickLine={false}
                              tick={{ fill: '#64748B', fontSize: 12 }}
                              dy={10}
                            />
                            <YAxis
                              axisLine={false}
                              tickLine={false}
                              tick={{ fill: '#64748B', fontSize: 12 }}
                              tickFormatter={(val) => `${val / 1000000}M`}
                            />
                            <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: '#F1F5F9' }} />
                            <Bar dataKey="salary" fill="#800020" radius={[4, 4, 0, 0]} barSize={40} />
                          </BarChart>
                        ) : (
                          <AreaChart data={salaryData.chartData || []} margin={{ top: 10, right: 10, left: 20, bottom: 0 }} onClick={handleChartClick}>
                            <defs>
                              <linearGradient id="colorSalary" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#800020" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#800020" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                            <XAxis
                              dataKey="label"
                              axisLine={false}
                              tickLine={false}
                              tick={{ fill: '#64748B', fontSize: 12 }}
                              dy={10}
                            />
                            <YAxis
                              axisLine={false}
                              tickLine={false}
                              tick={{ fill: '#64748B', fontSize: 12 }}
                              tickFormatter={(val) => `${val / 1000000}M`}
                            />
                            <RechartsTooltip content={<CustomTooltip />} />
                            <Area
                              type="monotone"
                              dataKey="salary"
                              stroke="#800020"
                              strokeWidth={3}
                              fillOpacity={1}
                              fill="url(#colorSalary)"
                              activeDot={{ r: 6, strokeWidth: 0, fill: '#800020' }}
                            />
                          </AreaChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              ) : null}

            </div>
          </div>
          {showRefreshConfirm && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
                <div className="bg-red-50 p-6 flex flex-col items-center text-center border-b border-red-100">
                  <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                    <AlertTriangle size={32} />
                  </div>
                  <h3 className="text-xl font-black text-red-700">CẢNH BÁO MẤT DỮ LIỆU!</h3>
                </div>
                <div className="p-6">
                  <p className="text-slate-700 mb-4 leading-relaxed font-medium">
                    Bạn có chắc chắn muốn làm mới lại toàn bộ dữ liệu từ máy chủ không?
                  </p>
                  <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg mb-6 text-sm text-amber-800">
                    <p className="font-bold mb-1">⚠️ Lưu ý cực kỳ quan trọng:</p>
                    <p>
                      Việc làm mới sẽ <strong>xóa sạch toàn bộ cấu hình Rank lương</strong> mà bạn đã cất công thiết lập trước đó. Vì lý do bảo mật và riêng tư, hệ thống tuyệt đối không lưu trữ bất kỳ thông tin nào liên quan đến thu nhập của bạn trên database.
                    </p>
                  </div>
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setShowRefreshConfirm(false)}
                      className="px-5 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                    >
                      Hủy bỏ, giữ lại Rank
                    </button>
                    <button
                      onClick={() => {
                        setShowRefreshConfirm(false);
                        refreshCacheMutation.mutate();
                      }}
                      className="px-5 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-600/30"
                    >
                      Vẫn làm mới
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          {showFutureWarning && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl relative border border-slate-100">
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-5xl">🔮</div>
                <h3 className="text-xl font-bold text-slate-800 mb-3 text-center mt-6">Tầm nhìn tương lai</h3>
                <p className="text-sm text-slate-600 mb-5 leading-relaxed text-center">
                  Dữ liệu công lương chỉ chính xác bắt đầu từ <strong className="text-burgundy">T{new Date().getMonth() + 1}/{new Date().getFullYear()}</strong> trở về trước. Nếu có các tháng nằm ngoài tháng hiện tại, bạn vui lòng chỉ xem để tham khảo thôi nhé!
                </p>
                <div className="flex items-center mb-6 justify-center">
                  <input
                    type="checkbox"
                    id="hideFutureWarning"
                    className="w-4 h-4 text-burgundy bg-slate-100 border-slate-300 rounded focus:ring-burgundy accent-burgundy"
                    onChange={(e) => {
                      if (e.target.checked) {
                        setNeverShowFutureWarning(true);
                        localStorage.setItem('hideFutureSalaryWarning', 'true');
                      } else {
                        setNeverShowFutureWarning(false);
                        localStorage.setItem('hideFutureSalaryWarning', 'false');
                      }
                    }}
                    checked={neverShowFutureWarning}
                  />
                  <label htmlFor="hideFutureWarning" className="ml-2 text-sm font-medium text-slate-700 cursor-pointer">
                    Tôi đã hiểu rồi và không hiện lại nữa
                  </label>
                </div>
                <button
                  onClick={() => setShowFutureWarning(false)}
                  className="w-full px-4 py-2.5 bg-burgundy text-white font-bold rounded-xl hover:bg-burgundy/90 transition-colors shadow-lg shadow-burgundy/30"
                >
                  Đóng
                </button>
              </div>
            </div>
          )}

          {showConfirmSaveRank && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl relative border border-slate-100">
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-5xl">🎯</div>
                <h3 className="text-xl font-bold text-slate-800 mb-3 text-center mt-6">Xác nhận áp dụng Rank</h3>
                <p className="text-sm text-slate-600 mb-4 leading-relaxed text-center">
                  Bạn đang chuẩn bị áp dụng cấu hình Rank lương mới. Vui lòng kiểm tra lại thông tin bên dưới:
                </p>
                <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl mb-6 flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 text-sm font-semibold">Mức Rank:</span>
                    <select
                      value={selectedRank}
                      onChange={e => {
                        const val = e.target.value;
                        setSelectedRank(val);
                        localStorage.setItem('selectedRankId', val);
                      }}
                      className="text-burgundy font-bold text-base bg-red-50 px-2 py-1 rounded-lg border border-red-100 outline-none focus:ring-2 focus:ring-burgundy/20 cursor-pointer"
                    >
                      {RANKS.map(rank => (
                        <option key={rank.id} value={rank.id}>
                          {rank.id} - {formatCurrency(rank.rate)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 text-sm font-semibold">Thời gian áp dụng:</span>
                    <span className="text-slate-800 font-bold text-base bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-sm">
                      {period === 'month' ? `Tháng ${fromMonth}/${fromYear}` : `T${fromMonth}/${fromYear} ➔ T${toMonth}/${toYear}`}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-center mb-6">
                  <label className="flex items-center cursor-pointer gap-2 select-none group">
                    <div className="relative flex items-center">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={autoShowPopup}
                        onChange={(e) => {
                          setAutoShowPopup(e.target.checked);
                          localStorage.setItem('autoShowSalaryPopup', String(e.target.checked));
                        }}
                      />
                      <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-burgundy group-hover:bg-slate-300 peer-checked:group-hover:bg-burgundy/90"></div>
                    </div>
                    <span className="text-xs font-semibold text-slate-500">
                      Tự động bật popup chọn nhanh trên biểu đồ
                    </span>
                  </label>
                </div>

                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => setShowConfirmSaveRank(false)}
                    className="flex-1 px-5 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    onClick={executeSaveRank}
                    disabled={saveRankMutation.isPending}
                    className="flex-1 px-5 py-2.5 bg-burgundy text-white font-bold rounded-xl hover:bg-burgundy/90 transition-colors shadow-lg shadow-burgundy/30 flex items-center justify-center disabled:opacity-70"
                  >
                    {saveRankMutation.isPending ? <Loader2 size={18} className="animate-spin mr-2" /> : null}
                    Đồng ý lưu
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
      <Footer />

      {/* How To Modal */}
      {showHowTo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                <AlertTriangle className="text-orange-500" size={20} />
                Hướng dẫn sử dụng Thống kê Công Lương
              </h3>
              <button onClick={() => setShowHowTo(false)} className="text-slate-400 hover:text-slate-600 p-1 bg-white rounded-md shadow-sm border border-slate-200 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-2 overflow-y-auto max-h-[70vh] flex justify-center bg-slate-100">
              <img src="/how-to.png" alt="Hướng dẫn" className="max-w-full h-auto object-contain rounded-xl shadow-sm" />
            </div>
            <div className="p-4 border-t border-slate-100 flex justify-end bg-slate-50">
              <button
                onClick={handleCloseHowTo}
                className="px-6 py-2.5 bg-burgundy text-white font-bold rounded-xl hover:bg-burgundy/90 transition-colors shadow-sm"
              >
                Tôi đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
