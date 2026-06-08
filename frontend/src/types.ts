export interface ClassInfo {
  id: string;
  code: string;
  name: string;
  students: number;
  totalHours: number;
  completedHours: number;
  nextSession: string;
  room: string;
  status: 'OPEN' | 'RUNNING' | 'FINISHED';
}

export interface Rank {
  id: string;
  name: string;
  rate: number; // in VND
}
