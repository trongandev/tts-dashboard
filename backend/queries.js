import { gql } from 'graphql-request'

const GET_CLASSES_QUERY = gql`
    query GetClasses(
        $search: String
        $centre: String
        $operationMethodId: [String]
        $openStatus: [String]
        $centres: [String]
        $courses: [String]
        $courseLines: [String]
        $startDateFrom: Date
        $startDateTo: Date
        $endDateFrom: Date
        $endDateTo: Date
        $haveSlotFrom: Date
        $haveSlotTo: Date
        $statusNotEquals: String
        $attendanceCheckedExists: Boolean
        $status: String
        $statusIn: [String]
        $attendanceStatus: [String]
        $studentAttendanceStatus: [String]
        $teacherAttendanceStatus: [String]
        $pageIndex: Int!
        $itemsPerPage: Int!
        $orderBy: String
        $teacherId: String
        $teacherSlot: [String]
        $passedSessionIndex: Int
        $unpassedSessionIndex: Int
        $haveSlotIn: HaveSlotIn
        $comments: ClassCommentQuery
    ) {
        classes(
            payload: {
                filter_textSearch: $search
                centre_equals: $centre
                centre_in: $centres
                operationMethodId_in: $operationMethodId
                teacher_equals: $teacherId
                teacherSlots: $teacherSlot
                course_in: $courses
                courseLine_in: $courseLines
                startDate_gt: $startDateFrom
                startDate_lt: $startDateTo
                endDate_gt: $endDateFrom
                endDate_lt: $endDateTo
                haveSlot_from: $haveSlotFrom
                haveSlot_to: $haveSlotTo
                status_ne: $statusNotEquals
                status_in: $statusIn
                status_equals: $status
                attendanceStatus_in: $attendanceStatus
                studentAttendanceStatus_in: $studentAttendanceStatus
                teacherAttendanceStatus_in: $teacherAttendanceStatus
                attendanceChecked_exists: $attendanceCheckedExists
                haveSlot_in: $haveSlotIn
                passedSessionIndex: $passedSessionIndex
                unpassedSessionIndex: $unpassedSessionIndex
                pageIndex: $pageIndex
                itemsPerPage: $itemsPerPage
                orderBy: $orderBy
                comments: $comments
                openStatus: $openStatus
            }
        ) {
            data {
                id
                name
                level
                course {
                    id
                    name
                    shortName
                }
                classSites {
                    _id
                    name
                }
                startDate
                endDate
                status
                centre {
                    id
                    name
                    shortName
                }
                openingRoomNo
                numberOfSessions
                numberOfSessionsStatus
                sessionHour
                totalHour
                slots {
                    _id
                    date
                    startTime
                    endTime
                    sessionHour
                    teachers {
                        _id
                        teacher {
                            id
                            username
                            fullName
                            email
                        }
                        role {
                            id
                            name
                            shortName
                        }
                        isActive
                    }
                    teacherAttendance {
                        _id
                        teacher {
                            id
                            username
                            fullName
                            email
                        }
                        status
                        note
                        createdBy
                        createdAt
                        lastModifiedBy
                        lastModifiedAt
                    }
                    studentAttendance {
                        _id
                        student {
                            fullName
                        }
                        status
                        comment
                    }
                }
                students {
                    _id
                    student {
                        id
                        customer {
                            fullName
                        }
                    }
                    activeInClass
                }
                teachers {
                    _id
                    teacher {
                        id
                        username
                        fullName
                        email
                    }
                    role {
                        id
                        name
                        shortName
                    }
                    isActive
                }
            }
            pagination {
                type
                total
            }
        }
    }
`

const GET_CLASSES_QUERY_FOR_TE = gql`
    query GetClasses(
        $search: String
        $centre: String
        $operationMethodId: [String]
        $openStatus: [String]
        $centres: [String]
        $courses: [String]
        $courseLines: [String]
        $startDateFrom: Date
        $startDateTo: Date
        $endDateFrom: Date
        $endDateTo: Date
        $haveSlotFrom: Date
        $haveSlotTo: Date
        $statusNotEquals: String
        $attendanceCheckedExists: Boolean
        $status: String
        $statusIn: [String]
        $attendanceStatus: [String]
        $studentAttendanceStatus: [String]
        $teacherAttendanceStatus: [String]
        $pageIndex: Int!
        $itemsPerPage: Int!
        $orderBy: String
        $teacherId: String
        $teacherSlot: [String]
        $passedSessionIndex: Int
        $unpassedSessionIndex: Int
        $haveSlotIn: HaveSlotIn
        $comments: ClassCommentQuery
    ) {
        classes(
            payload: {
                filter_textSearch: $search
                centre_equals: $centre
                centre_in: $centres
                operationMethodId_in: $operationMethodId
                teacher_equals: $teacherId
                teacherSlots: $teacherSlot
                course_in: $courses
                courseLine_in: $courseLines
                startDate_gt: $startDateFrom
                startDate_lt: $startDateTo
                endDate_gt: $endDateFrom
                endDate_lt: $endDateTo
                haveSlot_from: $haveSlotFrom
                haveSlot_to: $haveSlotTo
                status_ne: $statusNotEquals
                status_in: $statusIn
                status_equals: $status
                attendanceStatus_in: $attendanceStatus
                studentAttendanceStatus_in: $studentAttendanceStatus
                teacherAttendanceStatus_in: $teacherAttendanceStatus
                attendanceChecked_exists: $attendanceCheckedExists
                haveSlot_in: $haveSlotIn
                passedSessionIndex: $passedSessionIndex
                unpassedSessionIndex: $unpassedSessionIndex
                pageIndex: $pageIndex
                itemsPerPage: $itemsPerPage
                orderBy: $orderBy
                comments: $comments
                openStatus: $openStatus
            }
        ) {
            data {
                name
                status
                centre {
                    id
                    name
                    shortName
                }
                slots {
                    date
                    summary
                    teachers {
                        teacher {
                            code
                            username
                            fullName
                            email
                            phoneNumber
                        }
                        role {
                            shortName
                        }
                    }
                    teacherAttendance {
                        teacher {
                            code
                            username
                            fullName
                            email
                            phoneNumber
                        }
                        status
                    }
                }
            }
            pagination {
                type
                total
                __typename
            }
            __typename
        }
    }
`

// const GET_CLASSES_QUERY_FOR_TE1 = gql`
//     query GetClasses($pageIndex: Int!, $itemsPerPage: Int!, $orderBy: String, $teacherId: String, $search: String) {
//         classes(payload: { pageIndex: $pageIndex, itemsPerPage: $itemsPerPage, orderBy: $orderBy, teacher_equals: $teacherId, filter_textSearch: $search }) {
//             data {
//                 name
//                 status
//                 centre {
//                     id
//                     name
//                     shortName
//                 }
//                 slots {
//                     date
//                     summary
//                     teachers {
//                         teacher {
//                             code
//                             username
//                             fullName
//                             email
//                             phoneNumber
//                         }
//                         role {
//                             shortName
//                         }
//                     }
//                     teacherAttendance {
//                         teacher {
//                             code
//                             username
//                             fullName
//                             email
//                             phoneNumber
//                         }
//                         status
//                     }
//                 }
//             }
//             pagination {
//                 type
//                 total
//             }
//         }
//     }
// `

const GET_TIMESHEET_QUERY = gql`
    query findTimesheetByTeacher($teacherId: String, $startDate: String, $endDate: String, $type: String, $classId: String, $status: String, $classSessionStatusNotIn: [String]) {
        findTimesheetByTeacher(
            payload: { teacherId: $teacherId, startDate: $startDate, endDate: $endDate, type: $type, classId: $classId, status: $status, classSessionStatusNotIn: $classSessionStatusNotIn }
        ) {
            type
            centre {
                name
            }
            id
            date
            officeHour {
                status
                startTime
                studentCount
                endTime
                type
                courses {
                    id
                    shortName
                }
            }
            classSessionAttendance {
                id
                startTime
                endTime
                sessionHour
                status
                class {
                    id
                    name
                }
            }
            status
        }
    }
`

const FIND_INFO_QUERY = gql`
    mutation FindInfoInRoleById($payload: FindInfoInRoleByIdCommand!) {
        users {
            findInfoInRoleById(payload: $payload) {
                info
            }
        }
    }
`

export { GET_CLASSES_QUERY, GET_TIMESHEET_QUERY, FIND_INFO_QUERY, GET_CLASSES_QUERY_FOR_TE }
