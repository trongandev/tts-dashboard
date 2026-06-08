export interface RootObject {
  findTimesheetByTeacher: FindTimesheetByTeacher[];
}

export interface FindTimesheetByTeacher {
  type: string;
  centre: Centre;
  id: string;
  date: string;
  officeHour: OfficeHour;
  classSessionAttendance: ClassSessionAttendance;
  status: string;
  __typename: string;
}

export interface ClassSessionAttendance {
  id: string;
  startTime: string;
  endTime: string;
  sessionHour: number;
  status: string;
  class: Class;
  __typename: string;
}

export interface Class {
  id: string;
  name: string;
  __typename: string;
}

export interface OfficeHour {
  status: null;
  startTime: null;
  studentCount: null;
  endTime: null;
  type: null;
  courses: null;
  __typename: string;
}

export interface Centre {
  name: string;
  __typename: string;
}