import { gql } from 'graphql-request'

const GET_CLASSES_QUERY = gql`
    query GetClasses($pageIndex: Int!, $itemsPerPage: Int!, $orderBy: String, $teacherId: String, $search: String) {
        classes(payload: { pageIndex: $pageIndex, itemsPerPage: $itemsPerPage, orderBy: $orderBy, teacher_equals: $teacherId, filter_textSearch: $search }) {
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
                    teacherAttendance {
                        _id
                        teacher {
                            id
                            username
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

export { GET_CLASSES_QUERY, GET_TIMESHEET_QUERY, FIND_INFO_QUERY }
