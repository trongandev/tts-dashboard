interface RootObject {
    data: Data
}

interface Data {
    classes: Classes
}

interface Classes {
    data: Datum[]
    pagination: Pagination
    __typename: string
}

interface Pagination {
    type: string
    total: number
    __typename: string
}

interface Datum {
    id: string
    name: string
    level: string
    course: Course
    classSites: ClassSite[]
    startDate: string
    endDate: string
    status: string
    centre: Course
    openingRoomNo: number
    numberOfSessions: number
    numberOfSessionsStatus: string
    sessionHour: number
    totalHour: number
    slots: Slot[]
    students: Student[]
    teachers: Teacher[]
    operator: Operator
    operationMethod: OperationMethod
    classOpeningPlanId: null | string
    hasSchedule: boolean
    createdBy: string
    createdAt: string
    lastModifiedBy: null | string
    lastModifiedAt: string
    __typename: string
}

interface OperationMethod {
    id: string
    name: string
    __typename: string
}

interface Operator {
    id: string
    username: string
    firstName: string
    middleName: string
    lastName: string
    __typename: string
}

interface Customer {
    fullName: string
    phoneNumber: string
    email: null | string | string
    facebook: null | null | string
    zalo: null | null | string
    __typename: string
}

interface Slot {
    _id: string
    date: string
    startTime: string
    endTime: string
    sessionHour: number
    summary: null | string | string
    homework: null | null | string
    teachers: Teacher[]
    teacherAttendance: TeacherAttendance[]
    studentAttendance: StudentAttendance[]
    __typename: string
}

interface StudentAttendance {
    _id: string
    student: Student
    status: string
    comment: string
    sendCommentStatus: null
    __typename: string
}

interface Student {
    id: string
    fullName: string
    phoneNumber: null
    email: null
    gender: string
    imageUrl: null
    __typename: string
}

interface TeacherAttendance {
    _id: string
    teacher: Teacher
    status: string
    note: null
    createdBy: null
    createdAt: null
    lastModifiedBy: null
    lastModifiedAt: null
    __typename: string
}

interface Teacher {
    id: string
    username: string
    code: string
    fullName: string
    email: string
    phoneNumber: string
    user: string
    imageUrl: null | null | null | string | string | string | string
    __typename: string
}

interface ClassSite {
    _id: string
    name: string
    __typename: string
}

interface Course {
    id: string
    name: string
    shortName: string
    __typename: string
}
