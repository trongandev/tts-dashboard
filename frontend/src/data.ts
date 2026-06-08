import { ClassInfo, Rank } from './types';

export const RANKS: Rank[] = [
  { id: 'T0', name: 'Rank T0', rate: 70000 },
  { id: 'T1', name: 'Rank T1', rate: 90000 },
  { id: 'T2', name: 'Rank T2', rate: 100000 },
  { id: 'T3', name: 'Rank T3', rate: 120000 },
  { id: 'T4', name: 'Rank T4', rate: 140000 },
  { id: 'T5', name: 'Rank T5', rate: 150000 },
];

export const MOCK_CLASSES: ClassInfo[] = [
  {
    id: '1',
    code: 'BH-C4K-GB32',
    name: 'Game Builder 2D',
    students: 15,
    totalHours: 32,
    completedHours: 12,
    nextSession: 'T3, 18:00 - 20:00',
    room: 'Lab 01',
    status: 'Dang_dien_ra',
  },
  {
    id: '2',
    code: 'BH-C4K-SI18',
    name: 'Scratch Intermediate',
    students: 12,
    totalHours: 24,
    completedHours: 24,
    nextSession: 'Hoàn thành',
    room: 'Lab 03',
    status: 'Hoan_thanh',
  },
  {
    id: '3',
    code: 'BH-JSA03',
    name: 'JavaScript Advanced',
    students: 20,
    totalHours: 40,
    completedHours: 8,
    nextSession: 'T5, 19:30 - 21:30',
    room: 'Online - Zoom',
    status: 'Ngay_mai',
  },
  {
    id: '4',
    code: 'BH-ROB-SEMIB12',
    name: 'Robotics Semi B',
    students: 8,
    totalHours: 20,
    completedHours: 4,
    nextSession: 'CN, 08:30 - 10:30',
    room: 'Lab Robotics',
    status: 'Dang_dien_ra',
  },
];
