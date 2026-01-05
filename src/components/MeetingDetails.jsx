import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Calendar, Clock, Users, MapPin, CheckCircle, XCircle, BarChart3, Bell, Settings, Plus, Trash2, Edit3, User, Mail, CalendarDays } from 'lucide-react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { usePeriodicRefresh } from '../hooks/useRealtimeUpdates'
import { 
  addAnnouncement, 
  deleteAnnouncement, 
  isMeetingOwner, 
  isMeetingParticipant,
  hasPendingRequest,
  sendJoinRequest,
  handleJoinRequest,
  cancelJoinRequest,
  updateMeetingStatus,
  getParticipantsCountForSlot,
  startAttendanceCheck,
  endAttendanceCheck,
  submitAttendanceCode,
  getAttendanceStatus,
  getMemberAttendanceRates,
  getOptimalMeetingTimes,
  updateUserAvailability,
  setRecurringMeetingSchedule,
  removeRecurringMeetingSchedule,
  createRecurringEventsForParticipants,
  removeRecurringEventsForParticipants,
  getAttendanceHistory,
  getAttendanceRecordByDate,
  getAttendanceStatistics,
  getUserAttendanceHistory,
  getUserAttendanceRate,
  createMeetingScheduleFromSuggestion,
  removeSuggestedSchedule
} from '../services/firestoreService'
import TimeCoordination from './TimeCoordination'

const MeetingDetails = ({ meeting, currentUser, onBack, onDeleteMeeting }) => {
  // 모바일 감지
  const [isMobile, setIsMobile] = useState(false)
  const [showMobileTimeCoordination, setShowMobileTimeCoordination] = useState(false)
  
  // 반복 모임 일정 설정
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [scheduleData, setScheduleData] = useState({
    frequency: 'weekly',
    dayOfWeek: 1, // 월요일
    startTime: '14:00',
    endTime: '16:00',
    startDate: '',
    endDate: '',
    location: ''
  })

  // 출석 관리 상태
  const [attendanceCode, setAttendanceCode] = useState('')
  const [timeLeft, setTimeLeft] = useState(0)
  const [attendanceStatus, setAttendanceStatus] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedAttendanceDate, setSelectedAttendanceDate] = useState(new Date().toISOString().split('T')[0])
  const [showAttendanceHistory, setShowAttendanceHistory] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // 사용자 상태 확인
  const isOwner = isMeetingOwner(meeting, currentUser?.uid)
  const isParticipant = isMeetingParticipant(meeting, currentUser?.uid)
  const hasRequest = hasPendingRequest(meeting, currentUser?.uid)
  const canViewSchedule = isOwner || isParticipant

  // 시간 조율 완료 여부 확인
  const hasCompletedTimeCoordination = () => {
    if (!currentUser?.uid || !meeting?.availability) return false
    const userAvailability = meeting.availability[currentUser.uid]
    return userAvailability && userAvailability.length > 0
  }

  // 기본 탭 설정: 항상 세부사항 탭으로 이동
  const getDefaultTab = () => {
    if (!canViewSchedule) return 'announcements'
    return 'schedule'
  }

  const [activeTab, setActiveTab] = useState(getDefaultTab())
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false)
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    content: '',
    priority: 'normal'
  })

  // 시간 슬롯 생성 (9시부터 23시까지, 30분 단위)
  const generateTimeSlots = () => {
    const slots = []
    const startHour = 9
    const endHour = 23
    
    for (let hour = startHour; hour <= endHour; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
        slots.push({
          id: `${hour}-${minute}`,
          time: timeString,
          hour: hour,
          minute: minute
        })
      }
    }
    return slots
  }

  const timeSlots = generateTimeSlots()
  const weekDays = ['월', '화', '수', '목', '금']
  const weekDates = ['12.31', '01.01', '01.02', '01.03', '01.04'] // 예시 날짜

  // 각 시간 슬롯에 대한 참여자 수 계산
  const getParticipantCount = (dayIndex, slotId) => {
    const fullSlotId = `${dayIndex}-${slotId}`
    let count = 0
    
    if (meeting?.availability) {
      Object.values(meeting.availability).forEach(userSlots => {
        if (userSlots.includes(fullSlotId)) {
          count++
        }
      })
    }
    
    return count
  }

  // 슬롯 색상 결정 (참여자 수에 따라)
  const getSlotColor = (dayIndex, slotId) => {
    const count = getParticipantCount(dayIndex, slotId)
    const totalParticipants = meeting?.participants?.length || 1
    
    if (count === 0) {
      return 'bg-gray-100 border-gray-200'
    } else if (count === totalParticipants) {
      return 'bg-green-500 border-green-600 text-white'
    } else if (count >= totalParticipants * 0.8) {
      return 'bg-green-400 border-green-500 text-white'
    } else if (count >= totalParticipants * 0.6) {
      return 'bg-green-300 border-green-400 text-white'
    } else if (count >= totalParticipants * 0.4) {
      return 'bg-yellow-300 border-yellow-400 text-white'
    } else if (count >= totalParticipants * 0.2) {
      return 'bg-orange-300 border-orange-400 text-white'
    } else {
      return 'bg-red-200 border-red-300 text-red-800'
    }
  }

  // 참석율 계산
  const getAttendanceRate = () => {
    const totalParticipants = meeting?.participants?.length || 0
    const participantsWithAvailability = Object.keys(meeting?.availability || {}).length
    return totalParticipants > 0 ? Math.round((participantsWithAvailability / totalParticipants) * 100) : 0
  }

  // 참여자별 가용성 요약
  const getParticipantSummary = () => {
    const summary = []
    
    if (meeting?.participants) {
      meeting.participants.forEach(participant => {
        const userSlots = meeting.availability?.[participant.userId] || []
        const totalSlots = weekDays.length * timeSlots.length
        const availabilityRate = totalSlots > 0 ? Math.round((userSlots.length / totalSlots) * 100) : 0
        
        summary.push({
          userId: participant.userId,
          status: participant.status,
          availabilityRate,
          slotCount: userSlots.length
        })
      })
    }
    
    return summary
  }

  // 출석 관리 관련 함수들
  
  // 당일 출석확인 여부 확인
  const hasAttendanceToday = () => {
    if (!meeting?.attendanceHistory) return false
    const today = new Date().toISOString().split('T')[0]
    return meeting.attendanceHistory[today]?.isActive === false // 완료된 출석확인이 있는지 확인
  }
  
  const handleStartAttendance = async () => {
    try {
      setIsLoading(true)
      
      // 당일 이미 출석확인을 했는지 확인
      if (hasAttendanceToday()) {
        alert('오늘은 이미 출석확인을 완료했습니다.')
        setIsLoading(false)
        return
      }
      
      // 당일 날짜 사용 (YYYY-MM-DD 형식)
      const today = new Date().toISOString().split('T')[0]
      const result = await startAttendanceCheck(meeting.id, currentUser.uid, today)
      
      // 즉시 로컬 상태 업데이트
      setAttendanceCode(result.code)
      setTimeLeft(180) // 3분 = 180초
      
      // 즉시 attendanceStatus 업데이트 (Firestore 반영 전에 미리 업데이트)
      const endTime = new Date(result.endTime)
      const newStatus = {
        isActive: true,
        code: result.code,
        endTime: endTime.toISOString(),
        attendees: [],
        currentDate: today
      }
      setAttendanceStatus(newStatus)
      
      // 상태 업데이트를 확실히 하기 위해 약간의 지연 후 재확인
      setTimeout(() => {
        setAttendanceStatus(prevStatus => {
          if (!prevStatus || !prevStatus.isActive) {
            console.log('상태 복원:', newStatus)
            return newStatus
          }
          return prevStatus
        })
      }, 100)
      
      console.log(`출석 확인 시작: ${result.code}`)
    } catch (error) {
      alert('출석 확인 시작에 실패했습니다: ' + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleEndAttendance = async () => {
    try {
      setIsLoading(true)
      await endAttendanceCheck(meeting.id, currentUser.uid)
      
      // 즉시 로컬 상태 업데이트
      setAttendanceCode('')
      setTimeLeft(0)
      
      // 즉시 attendanceStatus 업데이트
      setAttendanceStatus({
        isActive: false,
        code: '',
        endTime: null,
        attendees: [],
        currentDate: null
      })
      
      console.log('출석 확인이 종료되었습니다.')
    } catch (error) {
      alert('출석 확인 종료에 실패했습니다: ' + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmitAttendanceCode = async () => {
    if (!attendanceCode.trim()) {
      alert('출석 코드를 입력해주세요.')
      return
    }

    try {
      setIsLoading(true)
      await submitAttendanceCode(meeting.id, currentUser.uid, attendanceCode.trim())
      console.log('출석 확인이 완료되었습니다!')
      setAttendanceCode('')
    } catch (error) {
      alert('출석 확인에 실패했습니다: ' + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  // 타이머 효과 (자동 종료 포함)
  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => {
        setTimeLeft(timeLeft - 1)
      }, 1000)
      return () => clearTimeout(timer)
    } else if (timeLeft === 0 && attendanceStatus?.isActive) {
      // 시간이 끝나면 자동으로 출석 확인 종료
      console.log('출석 확인 시간 만료 - 자동 종료')
      handleEndAttendance()
    }
  }, [timeLeft, attendanceStatus?.isActive])

  // 출석 상태 업데이트 (자동 코드 표시 포함)
  useEffect(() => {
    if (meeting) {
      const status = getAttendanceStatus(meeting)
      setAttendanceStatus(status)
      
      // 출석 확인이 활성화되면 자동으로 코드 표시
      if (status.isActive && meeting.attendanceCheck) {
        setAttendanceCode(meeting.attendanceCheck.code)
        console.log('출석 확인 활성화 - 코드 자동 표시:', meeting.attendanceCheck.code)
      } else {
        setAttendanceCode('')
      }
      
      if (status.isActive && status.endTime) {
        const endTime = new Date(status.endTime)
        const now = new Date()
        const remaining = Math.max(0, Math.floor((endTime - now) / 1000))
        setTimeLeft(remaining)
      } else if (!status.isActive) {
        setTimeLeft(0)
      }
    }
  }, [meeting])

  // 주기적 새로고침을 위한 함수
  const refreshAttendanceStatus = useCallback(() => {
    if (meeting) {
      console.log('출석 상태 주기적 새로고침 실행:', new Date().toLocaleTimeString())
      const status = getAttendanceStatus(meeting)
      
      // 로컬 상태와 Firestore 상태가 다를 때만 업데이트
      const localStatusActive = attendanceStatus?.isActive
      const firestoreStatusActive = status.isActive
      
      // 상태가 다르거나 로컬 상태가 없는 경우에만 업데이트
      if (localStatusActive !== firestoreStatusActive || !attendanceStatus) {
        console.log('상태 차이 감지, 업데이트:', { localStatusActive, firestoreStatusActive })
        setAttendanceStatus(status)
        
        // 출석 확인이 활성화되면 자동으로 코드 표시
        if (status.isActive && meeting.attendanceCheck) {
          setAttendanceCode(meeting.attendanceCheck.code)
        } else if (!status.isActive) {
          setAttendanceCode('')
        }
      }
      
      // 타이머는 항상 업데이트 (시간 경과 반영)
      if (status.isActive && status.endTime) {
        const endTime = new Date(status.endTime)
        const now = new Date()
        const remaining = Math.max(0, Math.floor((endTime - now) / 1000))
        setTimeLeft(remaining)
      } else if (!status.isActive) {
        setTimeLeft(0)
      }
    }
  }, [meeting, attendanceStatus])

  // 주기적 새로고침 설정 (3초마다)
  usePeriodicRefresh(refreshAttendanceStatus, 3000, [meeting?.id])

  // 출석 상태가 변경될 때마다 실시간 업데이트
  useEffect(() => {
    if (attendanceStatus?.isActive && attendanceStatus?.endTime) {
      const endTime = new Date(attendanceStatus.endTime)
      const now = new Date()
      const remaining = Math.max(0, Math.floor((endTime - now) / 1000))
      setTimeLeft(remaining)
    }
  }, [attendanceStatus])

  // 제안된 시간으로 자동 일정 생성
  const handleCreateScheduleFromSuggestion = async (suggestion) => {
    try {
      setIsLoading(true)
      
      const scheduleData = await createMeetingScheduleFromSuggestion(
        meeting.id, 
        suggestion, 
        currentUser.uid
      )
      
      alert(`모임 일정이 생성되었습니다!\n날짜: ${scheduleData.date}\n시간: ${scheduleData.startTime} - ${scheduleData.endTime}\n모든 참여자의 개인 일정에 자동으로 추가되었습니다.`)
      
    } catch (error) {
      console.error('일정 생성 실패:', error)
      alert('일정 생성에 실패했습니다: ' + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  // 제안된 일정 제거
  const handleRemoveSuggestedSchedule = async () => {
    if (!window.confirm('제안된 일정을 제거하시겠습니까? 모든 참여자의 개인 일정에서도 제거됩니다.')) {
      return
    }

    try {
      setIsLoading(true)
      
      await removeSuggestedSchedule(meeting.id, currentUser.uid)
      
      alert('제안된 일정이 제거되었습니다!')
      
    } catch (error) {
      console.error('일정 제거 실패:', error)
      alert('일정 제거에 실패했습니다: ' + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  // 실시간 출석 상태 업데이트를 위한 타이머
  useEffect(() => {
    if (attendanceStatus?.isActive && attendanceStatus?.endTime) {
      const interval = setInterval(() => {
        const status = getAttendanceStatus(meeting)
        setAttendanceStatus(status)
        
        if (status.isActive && status.endTime) {
          const endTime = new Date(status.endTime)
          const now = new Date()
          const remaining = Math.max(0, Math.floor((endTime - now) / 1000))
          setTimeLeft(remaining)
        } else {
          setTimeLeft(0)
        }
      }, 1000) // 1초마다 업데이트

      return () => clearInterval(interval)
    }
  }, [meeting, attendanceStatus?.isActive])

  const participantSummary = getParticipantSummary()

  // 공지사항 추가 함수
  const handleAddAnnouncement = async () => {
    if (!announcementForm.title.trim() || !announcementForm.content.trim()) {
      alert('제목과 내용을 모두 입력해주세요.')
      return
    }

    try {
      await addAnnouncement(meeting.id, announcementForm, currentUser.uid)
      setAnnouncementForm({ title: '', content: '', priority: 'normal' })
      setShowAnnouncementModal(false)
      
      // 성공 메시지
      alert('공지사항이 성공적으로 등록되었습니다!')
    } catch (error) {
      console.error('공지사항 추가 실패:', error)
      alert('공지사항 등록에 실패했습니다: ' + error.message)
    }
  }

  // 공지사항 삭제 함수
  const handleDeleteAnnouncement = async (announcementId) => {
    if (window.confirm('정말로 이 공지사항을 삭제하시겠습니까?')) {
      try {
        await deleteAnnouncement(meeting.id, announcementId, currentUser.uid)
      } catch (error) {
        alert(error.message)
      }
    }
  }

  // 모집 상태 변경 함수
  const handleStatusChange = async (newStatus) => {
    if (!isOwner) {
      alert('모임 소유자만 상태를 변경할 수 있습니다.')
      return
    }

    const statusText = {
      'open': '모집중',
      'closed': '모집마감',
      'full': '정원초과'
    }

    if (window.confirm(`모임 상태를 "${statusText[newStatus]}"으로 변경하시겠습니까?`)) {
      try {
        await updateMeetingStatus(meeting.id, newStatus, currentUser.uid)
        alert(`모임 상태가 "${statusText[newStatus]}"으로 변경되었습니다.`)
      } catch (error) {
        console.error('상태 변경 실패:', error)
        alert('상태 변경에 실패했습니다: ' + error.message)
      }
    }
  }

  // 가용성 변경 처리
  const handleAvailabilityChange = async (availability) => {
    if (!currentUser || !meeting) {
      console.error('사용자 또는 모임 정보가 없습니다.')
      return
    }

    try {
      await updateUserAvailability(meeting.id, currentUser.uid, availability)
      console.log('가용성 업데이트 완료:', availability.length, '개 슬롯')
    } catch (error) {
      console.error('가용성 업데이트 실패:', error)
      alert('가용성 저장에 실패했습니다: ' + error.message)
    }
  }

  // 반복 모임 일정 설정
  const handleSetRecurringSchedule = async () => {
    if (!isOwner) {
      alert('모임 소유자만 일정을 설정할 수 있습니다.')
      return
    }

    try {
      setIsLoading(true)
      
      // 반복 모임 일정 설정
      await setRecurringMeetingSchedule(meeting.id, scheduleData)
      
      // 참여자들의 개인 일정에 반영
      await createRecurringEventsForParticipants(meeting.id, {
        ...meeting,
        recurringSchedule: scheduleData
      })
      
      alert('반복 모임 일정이 설정되었습니다! 모든 참여자의 개인 일정에 자동으로 반영됩니다.')
      setShowScheduleModal(false)
      
    } catch (error) {
      console.error('반복 모임 일정 설정 실패:', error)
      alert('일정 설정에 실패했습니다: ' + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  // 반복 모임 일정 제거
  const handleRemoveRecurringSchedule = async () => {
    if (!isOwner) {
      alert('모임 소유자만 일정을 제거할 수 있습니다.')
      return
    }

    if (!window.confirm('정말로 반복 모임 일정을 제거하시겠습니까? 모든 참여자의 개인 일정에서도 제거됩니다.')) {
      return
    }

    try {
      setIsLoading(true)
      
      // 참여자들의 개인 일정에서 제거
      await removeRecurringEventsForParticipants(meeting.id)
      
      // 반복 모임 일정 제거
      await removeRecurringMeetingSchedule(meeting.id)
      
      alert('반복 모임 일정이 제거되었습니다!')
      
    } catch (error) {
      console.error('반복 모임 일정 제거 실패:', error)
      alert('일정 제거에 실패했습니다: ' + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  // 참가 신청 보내기
  const handleSendJoinRequest = async () => {
    if (!currentUser) {
      alert('로그인이 필요합니다.')
      return
    }

    setIsLoading(true)
    try {
      const userInfo = {
        displayName: currentUser.displayName || '익명',
        email: currentUser.email || '',
        photoURL: currentUser.photoURL || ''
      }
      
      await sendJoinRequest(meeting.id, currentUser.uid, userInfo)
      alert('참가 신청이 성공적으로 전송되었습니다!')
    } catch (error) {
      console.error('참가 신청 실패:', error)
      alert('참가 신청에 실패했습니다: ' + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  // 참가 신청 취소
  const handleCancelJoinRequest = async () => {
    if (!currentUser) return

    setIsLoading(true)
    try {
      await cancelJoinRequest(meeting.id, currentUser.uid)
      alert('참가 신청이 취소되었습니다.')
    } catch (error) {
      console.error('참가 신청 취소 실패:', error)
      alert('참가 신청 취소에 실패했습니다: ' + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  // 참가 신청 승인/거부
  const handleJoinRequestAction = async (userId, action) => {
    setIsLoading(true)
    try {
      await handleJoinRequest(meeting.id, userId, action)
      alert(`참가 신청이 ${action === 'approve' ? '승인' : '거부'}되었습니다.`)
    } catch (error) {
      console.error('참가 신청 처리 실패:', error)
      alert('참가 신청 처리에 실패했습니다: ' + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="sticky top-0 z-40 glass-effect border-b border-white/20 p-3 md:p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-0">
          <div className="flex items-center space-x-3 md:space-x-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onBack}
              className="p-2 rounded-xl bg-white dark:bg-gray-700 shadow-md hover:shadow-lg transition-all duration-300"
            >
              <ArrowLeft className="w-4 h-4 md:w-5 md:h-5 text-gray-600 dark:text-gray-300" />
            </motion.button>
            
            <div className="flex-1">
              <h1 className="text-lg md:text-2xl font-bold text-kaist-blue dark:text-white">
                모임 세부사항
              </h1>
              <p className="text-sm md:text-base text-gray-600 dark:text-gray-300 truncate">
                {meeting?.title}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between md:justify-end space-x-3 md:space-x-4">
            <div className="flex items-center space-x-3 md:space-x-4">
              <div className="flex items-center space-x-1 md:space-x-2">
                <Users className="w-4 h-4 md:w-5 md:h-5 text-gray-600 dark:text-gray-300" />
                <span className="text-xs md:text-sm text-gray-600 dark:text-gray-300">
                  {meeting?.participants?.filter(p => p.status === 'approved' || p.status === 'owner').length || 0}명
                </span>
              </div>
              <div className="flex items-center space-x-1 md:space-x-2">
                <BarChart3 className="w-4 h-4 md:w-5 md:h-5 text-gray-600 dark:text-gray-300" />
                <span className="text-xs md:text-sm text-gray-600 dark:text-gray-300">
                  {getAttendanceRate()}%
                </span>
              </div>
            </div>
            
            {/* 개설자만 삭제 버튼 표시 */}
            {isOwner && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  if (window.confirm('정말로 이 모임을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
                    onDeleteMeeting(meeting.id)
                  }
                }}
                className="flex items-center space-x-1 md:space-x-2 px-2 md:px-4 py-2 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-200 dark:hover:bg-red-900/30 transition-all duration-300"
              >
                <Trash2 className="w-4 h-4" />
                <span className="text-xs md:text-sm font-medium hidden md:inline">모임 삭제</span>
              </motion.button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* 모임 정보 카드 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="glass-effect rounded-2xl p-4 md:p-6 shadow-xl mb-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {/* 기본 정보 */}
            <div className="space-y-3 md:space-y-4">
              <h3 className="text-base md:text-lg font-semibold text-gray-800 dark:text-white mb-3 md:mb-4">모임 정보</h3>
              
              <div className="space-y-2 md:space-y-3">
                <div className="flex items-center space-x-2 md:space-x-3">
                  <div className="w-6 h-6 md:w-8 md:h-8 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-3 h-3 md:w-4 md:h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">모임 유형</p>
                    <p className="font-medium text-sm md:text-base text-gray-800 dark:text-white capitalize truncate">
                      {meeting?.type || 'study'}
                    </p>
                  </div>
                </div>
                
                {meeting?.location && (
                  <div className="flex items-center space-x-2 md:space-x-3">
                    <div className="w-6 h-6 md:w-8 md:h-8 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-3 h-3 md:w-4 md:h-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">장소</p>
                      <p className="font-medium text-sm md:text-base text-gray-800 dark:text-white truncate">
                        {meeting.location}
                      </p>
                    </div>
                  </div>
                )}
                
                <div className="flex items-center space-x-2 md:space-x-3">
                  <div className="w-6 h-6 md:w-8 md:h-8 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Users className="w-3 h-3 md:w-4 md:h-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">참여자 수</p>
                    <p className="font-medium text-sm md:text-base text-gray-800 dark:text-white">
                      {meeting?.participants?.filter(p => p.status === 'approved' || p.status === 'owner').length || 0}명
                      {meeting?.maxParticipants && ` / ${meeting.maxParticipants}명`}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* 담당자 정보 */}
            <div className="space-y-3 md:space-y-4">
              <h3 className="text-base md:text-lg font-semibold text-gray-800 dark:text-white mb-3 md:mb-4">담당자 정보</h3>
              
              <div className="space-y-2 md:space-y-3">
                {meeting?.organizer ? (
                  <div className="flex items-center space-x-2 md:space-x-3">
                    <div className="w-6 h-6 md:w-8 md:h-8 bg-orange-100 dark:bg-orange-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <User className="w-3 h-3 md:w-4 md:h-4 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">담당자</p>
                      <p className="font-medium text-sm md:text-base text-gray-800 dark:text-white truncate">
                        {meeting.organizer}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2 md:space-x-3">
                    <div className="w-6 h-6 md:w-8 md:h-8 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
                      <User className="w-3 h-3 md:w-4 md:h-4 text-gray-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">담당자</p>
                      <p className="font-medium text-sm md:text-base text-gray-500 dark:text-gray-400">
                        정보 없음
                      </p>
                    </div>
                  </div>
                )}
                
                {meeting?.organizerContact ? (
                  <div className="flex items-center space-x-2 md:space-x-3">
                    <div className="w-6 h-6 md:w-8 md:h-8 bg-teal-100 dark:bg-teal-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Mail className="w-3 h-3 md:w-4 md:h-4 text-teal-600 dark:text-teal-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">연락처</p>
                      <p className="font-medium text-sm md:text-base text-gray-800 dark:text-white truncate">
                        {meeting.organizerContact}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2 md:space-x-3">
                    <div className="w-6 h-6 md:w-8 md:h-8 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Mail className="w-3 h-3 md:w-4 md:h-4 text-gray-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">연락처</p>
                      <p className="font-medium text-sm md:text-base text-gray-500 dark:text-gray-400">
                        정보 없음
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* 모임 설명 */}
          {meeting?.description && (
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <h4 className="text-md font-semibold text-gray-800 dark:text-white mb-3">모임 설명</h4>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                {meeting.description}
              </p>
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="glass-effect rounded-2xl p-6 shadow-xl"
        >
          {/* Tab Navigation */}
          <div className="mb-8">
            {/* Desktop Tab Navigation */}
            <div className="hidden md:flex space-x-2 glass-effect p-1 rounded-xl">
              {canViewSchedule && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveTab('schedule')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all duration-300 ${
                    activeTab === 'schedule'
                      ? 'bg-kaist-blue text-white shadow-lg'
                      : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  <span className="font-medium">시간표</span>
                </motion.button>
              )}

              {canViewSchedule && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveTab('attendance')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all duration-300 ${
                    activeTab === 'attendance'
                      ? 'bg-kaist-blue text-white shadow-lg'
                      : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span className="font-medium">출석관리</span>
                </motion.button>
              )}


              {isOwner && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveTab('scheduleSettings')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all duration-300 ${
                    activeTab === 'scheduleSettings'
                      ? 'bg-kaist-blue text-white shadow-lg'
                      : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                >
                  <CalendarDays className="w-4 h-4" />
                  <span className="font-medium">일정 설정</span>
                </motion.button>
              )}

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveTab('announcements')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all duration-300 ${
                  activeTab === 'announcements'
                    ? 'bg-kaist-blue text-white shadow-lg'
                    : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
              >
                <Bell className="w-4 h-4" />
                <span className="font-medium">공지사항</span>
              </motion.button>

              {isOwner && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveTab('management')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all duration-300 ${
                    activeTab === 'management'
                      ? 'bg-kaist-blue text-white shadow-lg'
                      : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                >
                  <Settings className="w-4 h-4" />
                  <span className="font-medium">모임 관리</span>
                </motion.button>
              )}

              {isOwner && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveTab('requests')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all duration-300 ${
                    activeTab === 'requests'
                      ? 'bg-kaist-blue text-white shadow-lg'
                      : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span className="font-medium">참가 신청</span>
                  {meeting?.participants?.filter(p => p.status === 'pending').length > 0 && (
                    <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                      {meeting.participants.filter(p => p.status === 'pending').length}
                    </span>
                  )}
                </motion.button>
              )}
            </div>

            {/* Mobile Tab Navigation - Horizontal Scroll */}
            <div className="md:hidden">
              <div className="overflow-x-auto">
                <div className="flex space-x-2 pb-2 min-w-max">
                  {canViewSchedule && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setActiveTab('schedule')}
                      className={`flex flex-col items-center space-y-1 px-3 py-2 rounded-xl transition-all duration-300 min-w-[60px] ${
                        activeTab === 'schedule'
                          ? 'bg-kaist-blue text-white shadow-lg'
                          : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                      }`}
                    >
                      <Calendar className="w-5 h-5" />
                      <span className="text-xs font-medium">시간표</span>
                    </motion.button>
                  )}

                  {canViewSchedule && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setActiveTab('attendance')}
                      className={`flex flex-col items-center space-y-1 px-3 py-2 rounded-xl transition-all duration-300 min-w-[60px] ${
                        activeTab === 'attendance'
                          ? 'bg-kaist-blue text-white shadow-lg'
                          : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                      }`}
                    >
                      <BarChart3 className="w-5 h-5" />
                      <span className="text-xs font-medium">출석관리</span>
                    </motion.button>
                  )}


                  {isOwner && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setActiveTab('scheduleSettings')}
                      className={`flex flex-col items-center space-y-1 px-3 py-2 rounded-xl transition-all duration-300 min-w-[60px] ${
                        activeTab === 'scheduleSettings'
                          ? 'bg-kaist-blue text-white shadow-lg'
                          : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                      }`}
                    >
                      <CalendarDays className="w-5 h-5" />
                      <span className="text-xs font-medium">일정설정</span>
                    </motion.button>
                  )}

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setActiveTab('announcements')}
                    className={`flex flex-col items-center space-y-1 px-3 py-2 rounded-xl transition-all duration-300 min-w-[60px] ${
                      activeTab === 'announcements'
                        ? 'bg-kaist-blue text-white shadow-lg'
                        : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                    }`}
                  >
                    <Bell className="w-5 h-5" />
                    <span className="text-xs font-medium">공지사항</span>
                  </motion.button>

                  {isOwner && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setActiveTab('management')}
                      className={`flex flex-col items-center space-y-1 px-3 py-2 rounded-xl transition-all duration-300 min-w-[60px] ${
                        activeTab === 'management'
                          ? 'bg-kaist-blue text-white shadow-lg'
                          : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                      }`}
                    >
                      <Settings className="w-5 h-5" />
                      <span className="text-xs font-medium">모임관리</span>
                    </motion.button>
                  )}

                  {isOwner && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setActiveTab('requests')}
                      className={`flex flex-col items-center space-y-1 px-3 py-2 rounded-xl transition-all duration-300 min-w-[60px] relative ${
                        activeTab === 'requests'
                          ? 'bg-kaist-blue text-white shadow-lg'
                          : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                      }`}
                    >
                      <Users className="w-5 h-5" />
                      <span className="text-xs font-medium">참가신청</span>
                      {meeting?.participants?.filter(p => p.status === 'pending').length > 0 && (
                        <span className="bg-red-500 text-white text-xs px-1 py-0.5 rounded-full absolute -top-1 -right-1">
                          {meeting.participants.filter(p => p.status === 'pending').length}
                        </span>
                      )}
                    </motion.button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'schedule' && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                    전체 참여자 시간표
                  </h3>
                  {(isOwner || isParticipant) && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        if (isMobile) {
                          setShowMobileTimeCoordination(true)
                        } else {
                          setActiveTab('timeCoordination')
                        }
                      }}
                      className="flex items-center space-x-2 px-4 py-2 bg-kaist-blue text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      <Clock className="w-4 h-4" />
                      <span>시간표 조율하기</span>
                    </motion.button>
                  )}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  진한 색일수록 많은 사람이 가능한 시간입니다
                </p>
              </div>

              {/* 최적의 모임 시간 제안 */}
              {(() => {
                const optimalTimes = getOptimalMeetingTimes(meeting)
                const hasSuggestedSchedule = meeting?.suggestedSchedule
                
                // 디버깅을 위한 로그
                console.log('Meeting data for optimal times:', meeting)
                console.log('Optimal times result:', optimalTimes)
                console.log('Has suggested schedule:', hasSuggestedSchedule)
                
                return (
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-lg font-semibold text-gray-800 dark:text-white">
                        💡 최적의 모임 시간 제안
                      </h4>
                      {hasSuggestedSchedule && (
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={handleRemoveSuggestedSchedule}
                          disabled={isLoading}
                          className="px-3 py-1 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50 text-sm"
                        >
                          {isLoading ? '제거 중...' : '제안 일정 제거'}
                        </motion.button>
                      )}
                    </div>
                    
                    {hasSuggestedSchedule ? (
                      // 이미 제안된 일정이 있는 경우
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                        <div className="flex items-center space-x-3 mb-3">
                          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-800 rounded-lg flex items-center justify-center">
                            <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <h5 className="font-semibold text-blue-800 dark:text-blue-200">제안된 모임 일정</h5>
                            <p className="text-sm text-blue-600 dark:text-blue-400">모든 참여자의 개인 일정에 추가되었습니다</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="flex items-center space-x-2">
                            <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            <span className="text-sm text-blue-700 dark:text-blue-300">
                              {format(new Date(meeting.suggestedSchedule.date), 'yyyy년 M월 d일', { locale: ko })}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            <span className="text-sm text-blue-700 dark:text-blue-300">
                              {meeting.suggestedSchedule.startTime} - {meeting.suggestedSchedule.endTime}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            <span className="text-sm text-blue-700 dark:text-blue-300">
                              {meeting.suggestedSchedule.location || '장소 미정'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : optimalTimes.length > 0 ? (
                      // 제안할 수 있는 시간이 있는 경우
                      <div className="space-y-3">
                        {/* 연속 시간 우선 표시 */}
                        {optimalTimes.filter(t => t.isConsecutive).length > 0 && (
                          <div>
                            <div className="flex items-center space-x-2 mb-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                                추천: 연속 2시간 가능한 시간
                              </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              {optimalTimes.filter(t => t.isConsecutive).slice(0, 6).map((timeSlot, index) => (
                                <motion.div
                                  key={`consecutive-${index}`}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: index * 0.05 }}
                                  className="p-3 sm:p-4 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-lg border-2 border-green-300 dark:border-green-700 hover:shadow-md transition-shadow"
                                >
                                  <div className="flex items-start justify-between mb-2">
                                    <div className="flex-1">
                                      <div className="flex items-center space-x-2 mb-1">
                                        <span className="text-xs px-2 py-0.5 bg-green-500 text-white rounded-full font-medium">
                                          추천
                                        </span>
                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                          {timeSlot.consecutiveSlots * 30}분 연속
                                        </span>
                                      </div>
                                      <div className="font-semibold text-gray-800 dark:text-white text-sm sm:text-base">
                                        {timeSlot.day} {timeSlot.time} - {timeSlot.endTime}
                                      </div>
                                      <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
                                        {timeSlot.availableCount}/{timeSlot.totalParticipants}명 가능
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <div className={`text-base sm:text-lg font-bold ${
                                        timeSlot.availabilityRate >= 80 ? 'text-green-600 dark:text-green-400' :
                                        timeSlot.availabilityRate >= 60 ? 'text-yellow-600 dark:text-yellow-400' :
                                        'text-orange-600 dark:text-orange-400'
                                      }`}>
                                        {timeSlot.availabilityRate}%
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {isOwner && (
                                    <motion.button
                                      whileHover={{ scale: 1.02 }}
                                      whileTap={{ scale: 0.98 }}
                                      onClick={() => handleCreateScheduleFromSuggestion(timeSlot)}
                                      disabled={isLoading}
                                      className="w-full px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm font-medium"
                                    >
                                      {isLoading ? '생성 중...' : '이 시간으로 일정 생성'}
                                    </motion.button>
                                  )}
                                </motion.div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* 단일 시간 옵션 */}
                        {optimalTimes.filter(t => !t.isConsecutive).length > 0 && (
                          <div>
                            <div className="flex items-center space-x-2 mb-2">
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                                기타 가능한 시간
                              </span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                              {optimalTimes.filter(t => !t.isConsecutive).slice(0, 8).map((timeSlot, index) => (
                                <motion.div
                                  key={`single-${index}`}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: index * 0.05 }}
                                  className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700 hover:shadow-sm transition-shadow"
                                >
                                  <div className="text-center mb-2">
                                    <div className="font-medium text-gray-800 dark:text-white text-xs sm:text-sm">
                                      {timeSlot.day} {timeSlot.time}
                                    </div>
                                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                      {timeSlot.availableCount}/{timeSlot.totalParticipants}명
                                    </div>
                                    <div className={`text-sm font-bold mt-1 ${
                                      timeSlot.availabilityRate >= 80 ? 'text-green-600 dark:text-green-400' :
                                      timeSlot.availabilityRate >= 60 ? 'text-yellow-600 dark:text-yellow-400' :
                                      'text-orange-600 dark:text-orange-400'
                                    }`}>
                                      {timeSlot.availabilityRate}%
                                    </div>
                                  </div>
                                  
                                  {isOwner && (
                                    <motion.button
                                      whileHover={{ scale: 1.02 }}
                                      whileTap={{ scale: 0.98 }}
                                      onClick={() => handleCreateScheduleFromSuggestion(timeSlot)}
                                      disabled={isLoading}
                                      className="w-full px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs font-medium transition-colors disabled:opacity-50"
                                    >
                                      선택
                                    </motion.button>
                                  )}
                                </motion.div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      // 제안할 수 있는 시간이 없는 경우
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 text-center">
                        <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-500 dark:text-gray-400 mb-2">제안할 수 있는 시간이 없습니다</p>
                        <p className="text-sm text-gray-400 dark:text-gray-500">
                          참여자들이 시간표를 조율하면 최적의 시간을 제안할 수 있습니다
                        </p>
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Time Grid */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                {/* Mobile Horizontal Scroll Container */}
                <div className="overflow-x-auto">
                  <div className="min-w-[600px]">
                    {/* Header */}
                    <div className="grid grid-cols-6 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                      <div className="p-3 md:p-4 text-center font-medium text-gray-500 dark:text-gray-400 border-r border-gray-200 dark:border-gray-600 min-w-[80px]">
                        시간
                      </div>
                      {weekDays.map((day, index) => (
                        <div key={day} className="p-3 md:p-4 text-center border-r border-gray-200 dark:border-gray-600 last:border-r-0 min-w-[100px]">
                          <div className="font-medium text-gray-800 dark:text-gray-200 text-sm md:text-base">{day}</div>
                          <div className="text-xs md:text-sm text-gray-500 dark:text-gray-400">{weekDates[index]}</div>
                        </div>
                      ))}
                    </div>

                    {/* Time Slots */}
                    <div className="max-h-96 overflow-y-auto">
                      {timeSlots.map((slot) => (
                        <div key={slot.id} className="grid grid-cols-6 border-b border-gray-100 dark:border-gray-700">
                          {/* Time Label */}
                          <div className="p-2 md:p-3 text-center text-xs md:text-sm text-gray-600 dark:text-gray-400 border-r border-gray-200 dark:border-gray-600 min-w-[80px]">
                            {slot.time}
                          </div>

                          {/* Day Columns */}
                          {weekDays.map((_, dayIndex) => {
                            const count = getParticipantCount(dayIndex, slot.id)
                            return (
                              <div
                                key={dayIndex}
                                className={`p-2 md:p-3 text-center text-xs font-medium border-r border-gray-200 dark:border-gray-600 last:border-r-0 min-w-[100px] ${getSlotColor(dayIndex, slot.id)}`}
                              >
                                {count > 0 && count}
                              </div>
                            )
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Legend */}
              <div className="mt-4 p-3 md:p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <h4 className="font-medium text-gray-800 dark:text-white mb-2 text-sm md:text-base">범례</h4>
                <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2 md:gap-4 text-xs md:text-sm">
                  <div className="flex items-center space-x-1 md:space-x-2">
                    <div className="w-3 h-3 md:w-4 md:h-4 bg-green-500 rounded flex-shrink-0"></div>
                    <span className="text-gray-600 dark:text-gray-300">모든 참여자 가능</span>
                  </div>
                  <div className="flex items-center space-x-1 md:space-x-2">
                    <div className="w-3 h-3 md:w-4 md:h-4 bg-green-300 rounded flex-shrink-0"></div>
                    <span className="text-gray-600 dark:text-gray-300">80% 이상</span>
                  </div>
                  <div className="flex items-center space-x-1 md:space-x-2">
                    <div className="w-3 h-3 md:w-4 md:h-4 bg-yellow-300 rounded flex-shrink-0"></div>
                    <span className="text-gray-600 dark:text-gray-300">40-60%</span>
                  </div>
                  <div className="flex items-center space-x-1 md:space-x-2">
                    <div className="w-3 h-3 md:w-4 md:h-4 bg-red-200 rounded flex-shrink-0"></div>
                    <span className="text-gray-600 dark:text-gray-300">20% 미만</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'attendance' && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              {isOwner ? (
                // 모임장용 출석 관리 인터페이스
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                      출석 관리
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      간편한 출석 확인 시스템
                    </p>
                    {/* 당일 날짜 표시 */}
                    <div className="mt-3 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg inline-block">
                      <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                        {format(new Date(), 'yyyy년 M월 d일 (E)', { locale: ko })}
                      </span>
                    </div>
                  </div>

                  {/* 출석 관리 메인 */}
                  <div className="space-y-4">

                      {/* 출석 상태 */}
                      {attendanceStatus?.isActive && (
                        <div className="space-y-4">
                          {/* 출석 코드 표시 */}
                          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center">
                            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                              {attendanceCode}
                            </div>
                            <div className="text-sm text-blue-600 dark:text-blue-400 mb-2">
                              출석 코드
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              남은 시간: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                            </div>
                          </div>

                          {/* 출석 현황 */}
                          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                            <div className="text-center mb-3">
                              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                                {attendanceStatus.attendees?.length || 0}
                              </div>
                              <div className="text-sm text-green-600 dark:text-green-400">
                                출석 완료 ({meeting.participants?.filter(p => p.status === 'approved' || p.status === 'owner').length || 0}명 중)
                              </div>
                            </div>
                            
                            {/* 출석자 목록 */}
                            {attendanceStatus.attendees?.length > 0 && (
                              <div className="space-y-2">
                                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">출석자:</div>
                                <div className="flex flex-wrap gap-2">
                                  {attendanceStatus.attendees.map((attendee, index) => {
                                    const participant = meeting.participants?.find(p => p.userId === attendee.userId)
                                    return (
                                      <div key={attendee.userId} className="bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200 px-2 py-1 rounded text-xs">
                                        {participant?.name || `사용자${index + 1}`}
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                  </div>

                  {/* 출석 기록 관리 */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h4 className="text-lg font-semibold text-gray-800 dark:text-white">
                        📈 출석 기록 및 통계
                      </h4>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setShowAttendanceHistory(!showAttendanceHistory)}
                        className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
                      >
                        {showAttendanceHistory ? '숨기기' : '상세 보기'}
                      </motion.button>
                    </div>

                    {/* 출석 기록 보기 */}
                    {showAttendanceHistory ? (
                      <div className="space-y-4">
                        <h4 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                          출석 기록 ({getAttendanceHistory(meeting).length}회)
                        </h4>
                        
                        {/* 출석 통계 */}
                        {(() => {
                          const stats = getAttendanceStatistics(meeting)
                          return stats.totalSessions > 0 && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                                <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{stats.totalSessions}</div>
                                <div className="text-xs text-blue-600 dark:text-blue-400">총 세션</div>
                              </div>
                              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
                                <div className="text-lg font-bold text-green-600 dark:text-green-400">{stats.averageAttendanceRate}%</div>
                                <div className="text-xs text-green-600 dark:text-green-400">평균 출석률</div>
                              </div>
                              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 text-center">
                                <div className="text-lg font-bold text-purple-600 dark:text-purple-400">{stats.bestAttendanceRate}%</div>
                                <div className="text-xs text-purple-600 dark:text-purple-400">최고 출석률</div>
                              </div>
                              <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 text-center">
                                <div className="text-lg font-bold text-orange-600 dark:text-orange-400">{stats.totalAttendances}</div>
                                <div className="text-xs text-orange-600 dark:text-orange-400">총 출석 수</div>
                              </div>
                            </div>
                          )
                        })()}

                        {/* 날짜별 출석 기록 목록 */}
                        <div className="space-y-3">
                          {getAttendanceHistory(meeting).map((record) => (
                            <motion.div
                              key={record.date}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className={`p-4 rounded-lg border ${
                                record.date === selectedAttendanceDate
                                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
                                  : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <div className="text-sm font-medium text-gray-800 dark:text-white">
                                    {format(new Date(record.date), 'yyyy년 M월 d일', { locale: ko })}
                                  </div>
                                  <div className="text-sm text-gray-600 dark:text-gray-400">
                                    {record.attendees?.length || 0}/{record.totalParticipants}명
                                  </div>
                                  <div className={`text-sm font-semibold ${
                                    record.attendanceRate >= 80 ? 'text-green-600 dark:text-green-400' :
                                    record.attendanceRate >= 60 ? 'text-yellow-600 dark:text-yellow-400' :
                                    'text-red-600 dark:text-red-400'
                                  }`}>
                                    {record.attendanceRate}%
                                  </div>
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {record.isActive ? '진행 중' : '완료'}
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* 현재 출석 현황 */}
                        <div className="text-center mb-6">
                          <div className="text-3xl font-bold text-gray-800 dark:text-white mb-2">
                            {attendanceStatus?.attendanceRate || 0}%
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            출석률 ({attendanceStatus?.attendees?.length || 0}/{attendanceStatus?.totalParticipants || 0}명)
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {format(new Date(selectedAttendanceDate), 'yyyy년 M월 d일', { locale: ko })}
                          </div>
                        </div>

                        {attendanceStatus?.isActive && (
                          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-4">
                            <div className="text-center">
                              <div className="text-lg font-semibold text-blue-600 dark:text-blue-400 mb-2">
                                출석 확인 진행 중
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                출석 코드: <span className="font-mono font-bold">{attendanceStatus.code}</span>
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                남은 시간: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 출석 확인 시작/종료 버튼 */}
                        <div className="text-center">
                          {attendanceStatus?.isActive ? (
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={handleEndAttendance}
                              disabled={isLoading}
                              className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
                            >
                              {isLoading ? '종료 중...' : '출석 확인 종료'}
                            </motion.button>
                          ) : (
                            <motion.button
                              whileHover={{ scale: hasAttendanceToday() ? 1 : 1.05 }}
                              whileTap={{ scale: hasAttendanceToday() ? 1 : 0.95 }}
                              onClick={handleStartAttendance}
                              disabled={isLoading || hasAttendanceToday()}
                              className={`px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                                hasAttendanceToday() 
                                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
                                  : 'bg-green-500 hover:bg-green-600 text-white'
                              }`}
                            >
                              {isLoading ? '시작 중...' : hasAttendanceToday() ? '오늘 출석확인 완료' : '출석 확인 시작'}
                            </motion.button>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {/* 출석자 목록 */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                    <h4 className="font-semibold text-gray-800 dark:text-white mb-4">출석자 목록</h4>
                    <div className="space-y-3">
                      {attendanceStatus?.attendees?.length > 0 ? (
                        attendanceStatus.attendees.map((attendee, index) => {
                          const participant = meeting?.participants?.find(p => p.userId === attendee.userId)
                          return (
                            <div key={index} className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                              <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                                  <CheckCircle className="w-4 h-4 text-white" />
                                </div>
                                <div>
                                  <div className="font-medium text-gray-800 dark:text-white">
                                    {participant?.displayName || `사용자 ${attendee.userId}`}
                                  </div>
                                  <div className="text-sm text-gray-500 dark:text-gray-400">
                                    {participant?.status === 'owner' ? '모임장' : '참여자'}
                                  </div>
                                </div>
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                출석 완료
                              </div>
                            </div>
                          )
                        })
                      ) : (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                          <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p>아직 출석한 사람이 없습니다</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 모임원별 출석률 목록 */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold text-gray-800 dark:text-white">모임원별 출석률</h4>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        총 {getAttendanceHistory(meeting).length}회 출석 확인
                      </div>
                    </div>
                    <div className="space-y-3">
                      {(() => {
                        const memberRates = getMemberAttendanceRates(meeting)
                        return memberRates.length > 0 ? (
                          memberRates.map((member, index) => {
                            const userHistory = getUserAttendanceHistory(meeting, member.userId)
                            const userRate = getUserAttendanceRate(meeting, member.userId)
                            
                            return (
                              <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                              >
                                <div className="flex items-center space-x-3">
                                  <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center">
                                    <span className="text-white text-sm font-bold">
                                      {member.displayName.charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                  <div>
                                    <div className="font-medium text-gray-800 dark:text-white">
                                      {member.displayName}
                                    </div>
                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                      {member.attendanceCount}회 출석 / {userHistory.length}회 세션
                                    </div>
                                    <div className="text-xs text-gray-400 dark:text-gray-500">
                                      최근 출석: {(() => {
                                        const lastAttendance = userHistory
                                          .filter(record => record.attended)
                                          .sort((a, b) => new Date(b.date) - new Date(a.date))[0]
                                        return lastAttendance ? format(new Date(lastAttendance.date), 'M월 d일', { locale: ko }) : '없음'
                                      })()}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className={`text-lg font-semibold ${
                                    userRate >= 80 ? 'text-green-600 dark:text-green-400' :
                                    userRate >= 60 ? 'text-yellow-600 dark:text-yellow-400' :
                                    'text-red-600 dark:text-red-400'
                                  }`}>
                                    {userRate}%
                                  </div>
                                  <div className="text-sm text-gray-500 dark:text-gray-400">
                                    출석률
                                  </div>
                                </div>
                              </motion.div>
                            )
                          })
                        ) : (
                          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                            <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p>출석 데이터가 없습니다</p>
                            <p className="text-sm mt-2">출석 확인을 시작하면 여기에 표시됩니다</p>
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                </div>
              ) : (
                // 참여자용 출석 확인 인터페이스
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                      출석 확인
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      모임장이 제공한 출석 코드를 입력하세요
                    </p>
                  </div>

                  {attendanceStatus?.isActive ? (
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                      <div className="text-center mb-6">
                        <div className="text-lg font-semibold text-blue-600 dark:text-blue-400 mb-2">
                          출석 확인 진행 중
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                          남은 시간: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            출석 코드
                          </label>
                          <input
                            type="text"
                            value={attendanceCode}
                            onChange={(e) => setAttendanceCode(e.target.value)}
                            placeholder="6자리 출석 코드를 입력하세요"
                            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-center text-lg font-mono"
                            maxLength={6}
                          />
                        </div>
                        
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={handleSubmitAttendanceCode}
                          disabled={isLoading || !attendanceCode.trim()}
                          className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                          {isLoading ? '확인 중...' : '출석 확인'}
                        </motion.button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-600 p-8 text-center">
                      <Clock className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                      <h4 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        출석 확인 대기 중
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        모임장이 출석 확인을 시작하면 코드를 입력할 수 있습니다
                      </p>
                    </div>
                  )}

                  {/* 개인 출석 기록 */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                    <h4 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center">
                      <Users className="w-5 h-5 mr-2" />
                      내 출석 기록
                    </h4>
                    
                    {(() => {
                      const userHistory = getUserAttendanceHistory(meeting, currentUser.uid)
                      const userRate = getUserAttendanceRate(meeting, currentUser.uid)
                      
                      return userHistory.length > 0 ? (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
                              <div className="text-xl font-bold text-green-600 dark:text-green-400">
                                {userHistory.length}
                              </div>
                              <div className="text-xs text-green-600 dark:text-green-400">
                                출석 횟수
                              </div>
                            </div>
                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                              <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                                {userRate}%
                              </div>
                              <div className="text-xs text-blue-600 dark:text-blue-400">
                                출석률
                              </div>
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              최근 출석 기록
                            </h5>
                            {userHistory.slice(0, 5).map((record, index) => (
                              <div key={index} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                <div className="flex items-center space-x-2">
                                  <CheckCircle className="w-4 h-4 text-green-500" />
                                  <span className="text-sm text-gray-700 dark:text-gray-300">
                                    {format(new Date(record.date), 'M월 d일', { locale: ko })}
                                  </span>
                                </div>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  출석 완료
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-6">
                          <Users className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                          <p className="text-gray-500 dark:text-gray-400">
                            아직 출석 기록이 없습니다
                          </p>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* 시간 조율 탭 - 모임장과 승인받은 사람만 접근 가능 */}
          {activeTab === 'timeCoordination' && (isOwner || isParticipant) && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <TimeCoordination
                meeting={meeting}
                currentUser={currentUser}
                onBack={() => setActiveTab('schedule')}
                onComplete={() => setActiveTab('schedule')}
                onAvailabilityChange={handleAvailabilityChange}
              />
            </motion.div>
          )}

          {activeTab === 'scheduleSettings' && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="mb-4 md:mb-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-0 mb-3 md:mb-4">
                  <div className="flex-1">
                    <h3 className="text-base md:text-lg font-semibold text-gray-800 dark:text-white mb-1 md:mb-2">
                      반복 모임 일정 설정
                    </h3>
                    <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400">
                      정기적인 모임 일정을 설정하여 모든 참여자의 개인 일정에 자동으로 반영됩니다
                    </p>
                  </div>
                </div>
              </div>

              {/* 현재 반복 일정 상태 */}
              <div className="mb-6">
                {meeting?.recurringSchedule ? (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl p-4 md:p-6">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-8 h-8 bg-green-100 dark:bg-green-800 rounded-lg flex items-center justify-center">
                        <CalendarDays className="w-4 h-4 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-green-800 dark:text-green-200">반복 일정이 설정되어 있습니다</h4>
                        <p className="text-sm text-green-600 dark:text-green-400">모든 참여자의 개인 일정에 자동으로 반영됩니다</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Clock className="w-4 h-4 text-green-600 dark:text-green-400" />
                          <span className="text-sm font-medium text-green-800 dark:text-green-200">
                            {meeting.recurringSchedule.frequency === 'weekly' ? '매주' : '격주'} 
                            {['일', '월', '화', '수', '목', '금', '토'][meeting.recurringSchedule.dayOfWeek]}요일
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-4 h-4 text-green-600 dark:text-green-400" />
                          <span className="text-sm text-green-700 dark:text-green-300">
                            {meeting.recurringSchedule.startTime} - {meeting.recurringSchedule.endTime}
                          </span>
                        </div>
                        {meeting.recurringSchedule.location && (
                          <div className="flex items-center space-x-2">
                            <MapPin className="w-4 h-4 text-green-600 dark:text-green-400" />
                            <span className="text-sm text-green-700 dark:text-green-300">
                              {meeting.recurringSchedule.location}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-green-200 dark:border-green-700">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleRemoveRecurringSchedule}
                        disabled={isLoading}
                        className="px-4 py-2 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
                      >
                        {isLoading ? '제거 중...' : '반복 일정 제거'}
                      </motion.button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-4 md:p-6">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-8 h-8 bg-gray-100 dark:bg-gray-600 rounded-lg flex items-center justify-center">
                        <CalendarDays className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-800 dark:text-gray-200">반복 일정이 설정되지 않았습니다</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">정기적인 모임 일정을 설정해보세요</p>
                      </div>
                    </div>
                    
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setShowScheduleModal(true)}
                      className="btn-primary flex items-center space-x-2 px-4 py-2"
                    >
                      <CalendarDays className="w-4 h-4" />
                      <span>반복 일정 설정하기</span>
                    </motion.button>
                  </div>
                )}
              </div>

              {/* 최적의 모임 시간 제안 */}
              <div className="mb-6">
                <h4 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">
                  💡 최적의 모임 시간 제안
                </h4>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-4">
                  <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                    참여자들의 가용 시간을 분석하여 최적의 모임 시간을 제안합니다.
                  </p>
                  {(() => {
                    const optimalTimes = getOptimalMeetingTimes(meeting)
                    return optimalTimes.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {optimalTimes.slice(0, 6).map((timeSlot, index) => (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-600"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium text-gray-800 dark:text-white">
                                  {timeSlot.day} {timeSlot.time}
                                </div>
                                <div className="text-sm text-gray-600 dark:text-gray-400">
                                  {timeSlot.availableCount}/{timeSlot.totalParticipants}명 가능
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                                  {timeSlot.availabilityRate}%
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                        <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>가용 시간 데이터가 부족합니다</p>
                        <p className="text-sm">참여자들이 시간 조율을 완료하면 제안이 표시됩니다</p>
                      </div>
                    )
                  })()}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'announcements' && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="mb-4 md:mb-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-0 mb-3 md:mb-4">
                  <div className="flex-1">
                    <h3 className="text-base md:text-lg font-semibold text-gray-800 dark:text-white mb-1 md:mb-2">
                      공지사항
                    </h3>
                    <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400">
                      모임 관련 중요한 공지사항을 확인하세요
                    </p>
                  </div>
                  
                  {isOwner && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setShowAnnouncementModal(true)}
                      className="btn-primary flex items-center space-x-1 md:space-x-2 px-3 md:px-4 py-2 md:py-3"
                    >
                      <Plus className="w-4 h-4" />
                      <span className="hidden md:inline">공지 추가</span>
                      <span className="md:hidden">추가</span>
                    </motion.button>
                  )}
                </div>
              </div>

              {/* 공지사항 목록 */}
              <div className="space-y-3 md:space-y-4">
                {meeting?.announcements?.length > 0 ? (
                  meeting.announcements.map((announcement) => (
                    <div
                      key={announcement.id}
                      className={`p-3 md:p-4 border rounded-lg ${
                        announcement.priority === 'high'
                          ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                          : announcement.priority === 'low'
                          ? 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                          : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-0 mb-2">
                        <div className="flex items-center space-x-2 min-w-0 flex-1">
                          <Bell className={`w-4 h-4 flex-shrink-0 ${
                            announcement.priority === 'high' ? 'text-red-500' :
                            announcement.priority === 'low' ? 'text-gray-500' : 'text-blue-500'
                          }`} />
                          <span className={`font-medium text-sm md:text-base truncate ${
                            announcement.priority === 'high' ? 'text-red-700 dark:text-red-300' :
                            announcement.priority === 'low' ? 'text-gray-700 dark:text-gray-300' : 'text-blue-700 dark:text-blue-300'
                          }`}>
                            {announcement.title}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${
                            announcement.priority === 'high' ? 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-800' :
                            announcement.priority === 'low' ? 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800' : 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-800'
                          }`}>
                            {announcement.priority === 'high' ? '긴급' :
                             announcement.priority === 'low' ? '일반' : '중요'}
                          </span>
                        </div>
                        
                        {isOwner && (
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleDeleteAnnouncement(announcement.id)}
                            className="p-1 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 flex-shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </motion.button>
                        )}
                      </div>
                      
                      <p className={`text-xs md:text-sm mb-2 ${
                        announcement.priority === 'high' ? 'text-red-600 dark:text-red-400' :
                        announcement.priority === 'low' ? 'text-gray-600 dark:text-gray-400' : 'text-blue-600 dark:text-blue-400'
                      }`}>
                        {announcement.content}
                      </p>
                      
                      <div className={`text-xs ${
                        announcement.priority === 'high' ? 'text-red-500 dark:text-red-400' :
                        announcement.priority === 'low' ? 'text-gray-500 dark:text-gray-400' : 'text-blue-500 dark:text-blue-400'
                      }`}>
                        {(() => {
                          try {
                            if (!announcement.createdAt) return '날짜 미정'
                            const date = announcement.createdAt.toDate ? announcement.createdAt.toDate() : new Date(announcement.createdAt)
                            if (isNaN(date.getTime())) return '날짜 오류'
                            return format(date, 'yyyy년 M월 d일 HH:mm', { locale: ko })
                          } catch (error) {
                            console.error('날짜 포맷 오류:', error)
                            return '날짜 오류'
                          }
                        })()}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-6 md:p-8 text-center bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <Bell className="w-8 h-8 md:w-12 md:h-12 text-gray-400 mx-auto mb-3 md:mb-4" />
                    <p className="text-sm md:text-base text-gray-500 dark:text-gray-400 mb-2">아직 공지사항이 없습니다</p>
                    <p className="text-xs md:text-sm text-gray-400 dark:text-gray-500">
                      {isOwner ? '새로운 공지사항을 추가해보세요' : '모임장이 공지사항을 추가하면 여기에 표시됩니다'}
                    </p>
                  </div>
                )}

                {/* 기본 모임 정보 */}
                <div className="p-3 md:p-4 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <Settings className="w-4 h-4 text-gray-500" />
                    <span className="font-medium text-sm md:text-base text-gray-700 dark:text-gray-300">모임 정보</span>
                  </div>
                  <div className="text-xs md:text-sm text-gray-600 dark:text-gray-400 space-y-1">
                    <div>• 모임 유형: {meeting?.type || '스터디'}</div>
                    <div>• 최대 참여자: {meeting?.maxParticipants || '제한 없음'}명</div>
                    <div>• 장소: {meeting?.location || '미정'}</div>
                    <div>• 생성일: {(() => {
                      try {
                        if (!meeting?.createdAt) return '날짜 미정'
                        const date = meeting.createdAt.toDate ? meeting.createdAt.toDate() : new Date(meeting.createdAt)
                        if (isNaN(date.getTime())) return '날짜 오류'
                        return format(date, 'yyyy년 M월 d일', { locale: ko })
                      } catch (error) {
                        console.error('날짜 포맷 오류:', error)
                        return '날짜 오류'
                      }
                    })()}</div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* 참가 신청 탭 */}
          {activeTab === 'requests' && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
                  참가 신청 관리
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  모임 참가를 신청한 사용자들을 관리하세요
                </p>
              </div>

              {/* 대기 중인 참가 신청 */}
              <div className="space-y-4">
                <h4 className="text-md font-medium text-gray-700 dark:text-gray-300">
                  대기 중인 참가 신청 ({meeting?.participants?.filter(p => p.status === 'pending').length || 0}명)
                </h4>
                
                {meeting?.participants?.filter(p => p.status === 'pending').length > 0 ? (
                  <div className="space-y-3">
                    {meeting.participants
                      .filter(p => p.status === 'pending')
                      .map((participant) => (
                        <motion.div
                          key={participant.userId}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-white dark:bg-gray-700 rounded-xl p-4 border border-gray-200 dark:border-gray-600"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                                {participant.displayName?.charAt(0)?.toUpperCase() || 'U'}
                              </div>
                              <div>
                                <p className="font-medium text-gray-800 dark:text-white">
                                  {participant.displayName || '익명'}
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  {participant.email || '이메일 정보 없음'}
                                </p>
                                <p className="text-xs text-gray-400 dark:text-gray-500">
                                  신청일: {(() => {
                                    try {
                                      const date = new Date(participant.joinedAt)
                                      return format(date, 'yyyy년 M월 d일 HH:mm', { locale: ko })
                                    } catch (error) {
                                      return '날짜 오류'
                                    }
                                  })()}
                                </p>
                              </div>
                            </div>
                            
                            <div className="flex space-x-2">
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleJoinRequestAction(participant.userId, 'approve')}
                                disabled={isLoading}
                                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                승인
                              </motion.button>
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleJoinRequestAction(participant.userId, 'reject')}
                                disabled={isLoading}
                                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                거부
                              </motion.button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                  </div>
                ) : (
                  <div className="p-8 text-center bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">대기 중인 참가 신청이 없습니다</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* 모임 관리 탭 */}
          {activeTab === 'management' && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="mb-4 md:mb-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-0 mb-3 md:mb-4">
                  <div className="flex-1">
                    <h3 className="text-base md:text-lg font-semibold text-gray-800 dark:text-white mb-1 md:mb-2">
                      모임 관리
                    </h3>
                    <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400">
                      모임의 상태와 설정을 관리하세요
                    </p>
                  </div>
                </div>
              </div>

              {/* 모집 상태 관리 */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
                <h4 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center">
                  <Settings className="w-5 h-5 mr-2 text-blue-500" />
                  모집 상태 관리
                </h4>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-800 dark:text-white">현재 모집 상태</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {meeting?.status === 'open' && '모집중 - 새로운 참가 신청을 받고 있습니다'}
                        {meeting?.status === 'closed' && '모집마감 - 새로운 참가 신청을 받지 않습니다'}
                        {meeting?.status === 'full' && '정원초과 - 최대 참가자 수에 도달했습니다'}
                      </div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                      meeting?.status === 'open' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' :
                      meeting?.status === 'closed' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300' :
                      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300'
                    }`}>
                      {meeting?.status === 'open' && '모집중'}
                      {meeting?.status === 'closed' && '모집마감'}
                      {meeting?.status === 'full' && '정원초과'}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleStatusChange('open')}
                      disabled={meeting?.status === 'open'}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        meeting?.status === 'open'
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                          : 'border-gray-200 dark:border-gray-600 hover:border-green-300 dark:hover:border-green-700 text-gray-700 dark:text-gray-300'
                      } disabled:cursor-default`}
                    >
                      <div className="text-center">
                        <div className="font-medium mb-1">모집중</div>
                        <div className="text-xs opacity-75">새로운 참가 신청 허용</div>
                      </div>
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleStatusChange('closed')}
                      disabled={meeting?.status === 'closed'}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        meeting?.status === 'closed'
                          ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                          : 'border-gray-200 dark:border-gray-600 hover:border-red-300 dark:hover:border-red-700 text-gray-700 dark:text-gray-300'
                      } disabled:cursor-default`}
                    >
                      <div className="text-center">
                        <div className="font-medium mb-1">모집마감</div>
                        <div className="text-xs opacity-75">새로운 참가 신청 차단</div>
                      </div>
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleStatusChange('full')}
                      disabled={meeting?.status === 'full'}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        meeting?.status === 'full'
                          ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300'
                          : 'border-gray-200 dark:border-gray-600 hover:border-yellow-300 dark:hover:border-yellow-700 text-gray-700 dark:text-gray-300'
                      } disabled:cursor-default`}
                    >
                      <div className="text-center">
                        <div className="font-medium mb-1">정원초과</div>
                        <div className="text-xs opacity-75">최대 참가자 수 도달</div>
                      </div>
                    </motion.button>
                  </div>
                </div>
              </div>

              {/* 모임 정보 요약 */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <h4 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center">
                  <Users className="w-5 h-5 mr-2 text-blue-500" />
                  모임 정보 요약
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="text-sm text-blue-600 dark:text-blue-400 mb-1">총 참가자</div>
                    <div className="text-2xl font-bold text-blue-800 dark:text-blue-300">
                      {meeting?.participants?.filter(p => p.status === 'approved' || p.status === 'owner').length || 0}명
                    </div>
                  </div>
                  
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="text-sm text-green-600 dark:text-green-400 mb-1">대기 중인 신청</div>
                    <div className="text-2xl font-bold text-green-800 dark:text-green-300">
                      {meeting?.participants?.filter(p => p.status === 'pending').length || 0}건
                    </div>
                  </div>
                  
                  <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <div className="text-sm text-purple-600 dark:text-purple-400 mb-1">공지사항</div>
                    <div className="text-2xl font-bold text-purple-800 dark:text-purple-300">
                      {meeting?.announcements?.length || 0}개
                    </div>
                  </div>
                  
                  <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                    <div className="text-sm text-orange-600 dark:text-orange-400 mb-1">출석 세션</div>
                    <div className="text-2xl font-bold text-orange-800 dark:text-orange-300">
                      {getAttendanceHistory(meeting).length}회
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* 비참가자를 위한 참가 신청 버튼 */}
          {!canViewSchedule && !hasRequest && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mt-8 p-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-700 rounded-2xl border border-blue-200 dark:border-gray-600"
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-kaist-blue to-kaist-lightblue rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                  이 모임에 참가하고 싶으신가요?
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  참가 신청을 보내면 모임장이 승인 후 시간표 설정이 가능합니다.
                </p>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSendJoinRequest}
                  disabled={isLoading}
                  className="bg-kaist-blue hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? '신청 중...' : '참가 신청하기'}
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* 참가 신청 대기 중인 경우 */}
          {hasRequest && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mt-8 p-6 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-gray-800 dark:to-gray-700 rounded-2xl border border-yellow-200 dark:border-gray-600"
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                  참가 신청이 대기 중입니다
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  모임장이 승인하면 시간표 설정이 가능합니다.
                </p>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleCancelJoinRequest}
                  disabled={isLoading}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-8 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? '취소 중...' : '참가 신청 취소'}
                </motion.button>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* 공지사항 추가 모달 */}
      {showAnnouncementModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowAnnouncementModal(false)}
        >
          <motion.div
            initial={{ scale: 0.9, y: 50 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 50 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-kaist-blue to-kaist-lightblue rounded-xl flex items-center justify-center">
                  <Bell className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-kaist-blue dark:text-white">
                    공지사항 추가
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    새로운 공지사항을 작성하세요
                  </p>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowAnnouncementModal(false)}
                className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <XCircle className="w-5 h-5 text-gray-500 dark:text-gray-300" />
              </motion.button>
            </div>

            {/* Form */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  제목 *
                </label>
                <input
                  type="text"
                  value={announcementForm.title}
                  onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                  className="input-field"
                  placeholder="공지사항 제목을 입력하세요"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  내용 *
                </label>
                <textarea
                  value={announcementForm.content}
                  onChange={(e) => setAnnouncementForm({ ...announcementForm, content: e.target.value })}
                  className="input-field min-h-[120px] resize-none"
                  placeholder="공지사항 내용을 입력하세요"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  우선순위
                </label>
                <select
                  value={announcementForm.priority}
                  onChange={(e) => setAnnouncementForm({ ...announcementForm, priority: e.target.value })}
                  className="input-field"
                >
                  <option value="low">일반</option>
                  <option value="normal">중요</option>
                  <option value="high">긴급</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-4 mt-6">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowAnnouncementModal(false)}
                  className="btn-secondary"
                >
                  취소
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleAddAnnouncement}
                  className="btn-primary"
                >
                  추가
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* 모바일 시간 조율 모달 */}
      {showMobileTimeCoordination && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm md:hidden"
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-800 rounded-t-3xl shadow-2xl max-h-[90vh] overflow-hidden"
          >
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowMobileTimeCoordination(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
                시간 조율
              </h2>
              <div className="w-9"></div> {/* 중앙 정렬을 위한 공간 */}
            </div>

            {/* 모달 내용 */}
            <div className="flex-1 overflow-hidden">
              <TimeCoordination
                meeting={meeting}
                currentUser={currentUser}
                onBack={() => setShowMobileTimeCoordination(false)}
                onComplete={() => {
                  setShowMobileTimeCoordination(false)
                  setActiveTab('schedule')
                }}
                onAvailabilityChange={handleAvailabilityChange}
                isMobileModal={true}
              />
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* 반복 모임 일정 설정 모달 */}
      {showScheduleModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowScheduleModal(false)}
        >
          <motion.div
            initial={{ scale: 0.9, y: 50 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 50 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-kaist-blue rounded-xl flex items-center justify-center">
                  <CalendarDays className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">반복 모임 일정 설정</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">정기적인 모임 일정을 설정하세요</p>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowScheduleModal(false)}
                className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <XCircle className="w-5 h-5 text-gray-500" />
              </motion.button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* 반복 주기 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  반복 주기
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setScheduleData({ ...scheduleData, frequency: 'weekly' })}
                    className={`p-3 rounded-xl border transition-all ${
                      scheduleData.frequency === 'weekly'
                        ? 'border-kaist-blue bg-blue-50 dark:bg-blue-900/20 text-kaist-blue'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                  >
                    <div className="text-center">
                      <div className="font-medium">매주</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">일주일마다</div>
                    </div>
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setScheduleData({ ...scheduleData, frequency: 'biweekly' })}
                    className={`p-3 rounded-xl border transition-all ${
                      scheduleData.frequency === 'biweekly'
                        ? 'border-kaist-blue bg-blue-50 dark:bg-blue-900/20 text-kaist-blue'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                  >
                    <div className="text-center">
                      <div className="font-medium">격주</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">2주마다</div>
                    </div>
                  </motion.button>
                </div>
              </div>

              {/* 요일 선택 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  요일
                </label>
                <div className="grid grid-cols-7 gap-2">
                  {['일', '월', '화', '수', '목', '금', '토'].map((day, index) => (
                    <motion.button
                      key={day}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setScheduleData({ ...scheduleData, dayOfWeek: index })}
                      className={`p-2 rounded-lg text-sm font-medium transition-all ${
                        scheduleData.dayOfWeek === index
                          ? 'bg-kaist-blue text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {day}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* 시간 설정 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    시작 시간
                  </label>
                  <input
                    type="time"
                    value={scheduleData.startTime}
                    onChange={(e) => setScheduleData({ ...scheduleData, startTime: e.target.value })}
                    className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-kaist-blue focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    종료 시간
                  </label>
                  <input
                    type="time"
                    value={scheduleData.endTime}
                    onChange={(e) => setScheduleData({ ...scheduleData, endTime: e.target.value })}
                    className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-kaist-blue focus:border-transparent"
                  />
                </div>
              </div>

              {/* 날짜 범위 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    시작 날짜
                  </label>
                  <input
                    type="date"
                    value={scheduleData.startDate}
                    onChange={(e) => setScheduleData({ ...scheduleData, startDate: e.target.value })}
                    className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-kaist-blue focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    종료 날짜 (한 학기)
                  </label>
                  <input
                    type="date"
                    value={scheduleData.endDate}
                    onChange={(e) => setScheduleData({ ...scheduleData, endDate: e.target.value })}
                    className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-kaist-blue focus:border-transparent"
                  />
                </div>
              </div>

              {/* 장소 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  장소 (선택사항)
                </label>
                <input
                  type="text"
                  value={scheduleData.location}
                  onChange={(e) => setScheduleData({ ...scheduleData, location: e.target.value })}
                  placeholder="예: 김병호·김상열 융합 빌딩 101호"
                  className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-kaist-blue focus:border-transparent"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowScheduleModal(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              >
                취소
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleSetRecurringSchedule}
                disabled={isLoading || !scheduleData.startDate || !scheduleData.endDate}
                className="btn-primary flex items-center space-x-2 px-6 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CalendarDays className="w-4 h-4" />
                <span>{isLoading ? '설정 중...' : '일정 설정'}</span>
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}

export default MeetingDetails
