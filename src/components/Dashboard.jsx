import React, { useState, useEffect, useMemo, memo } from 'react'
import { motion } from 'framer-motion'
import { Calendar, Clock, Users, Bell, TrendingUp, MapPin, ChevronRight, AlertCircle, CheckCircle, Calendar as CalendarIcon, X } from 'lucide-react'
import { format, isToday, isTomorrow, isYesterday, addDays, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns'
import { ko } from 'date-fns/locale'

const Dashboard = ({ 
  selectedDate, 
  setSelectedDate, 
  events, 
  meetings, 
  onEventClick, 
  onDateClick,
  onMeetingClick,
  onViewChange,
  currentUser 
}) => {
  // 이벤트 데이터 디버깅
  console.log('Dashboard - 받은 이벤트 데이터:', events.length, '개 이벤트')
  console.log('Dashboard - 이벤트 목록:', events)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [showDateEvents, setShowDateEvents] = useState(false)
  const [selectedDateForEvents, setSelectedDateForEvents] = useState(null)

  // 실시간 시간 업데이트
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // 날짜 클릭 핸들러
  const handleDateClick = (date) => {
    setSelectedDateForEvents(date)
    setShowDateEvents(true)
  }

  // 특정 날짜의 일정 필터링 (본인 일정만)
  const getEventsForDate = (date) => {
    if (!date || !currentUser?.uid) return []
    
    const targetDateStr = format(date, 'yyyy-MM-dd')
    
    const filteredEvents = events.filter(event => {
      // 본인의 일정만 표시
      if (event.userId !== currentUser.uid) {
        return false
      }
      
      // event.date가 Date 객체, 문자열, 또는 Timestamp일 수 있음
      let eventDate
      if (event.date instanceof Date) {
        eventDate = event.date
      } else if (event.date?.toDate) {
        // Firestore Timestamp
        eventDate = event.date.toDate()
      } else if (typeof event.date === 'string') {
        eventDate = new Date(event.date)
      } else {
        return false
      }
      
      // 날짜 비교 (시간 제외)
      const eventDateStr = format(eventDate, 'yyyy-MM-dd')
      return eventDateStr === targetDateStr
    })
    
    return filteredEvents
  }

  // 다가오는 일정 (오늘부터 7일간, 본인 일정만)
  const upcomingEvents = events
    .filter(event => {
      // 본인의 일정만 표시
      if (event.userId !== currentUser?.uid) {
        return false
      }
      
      // 날짜 변환
      let eventDate
      if (event.date instanceof Date) {
        eventDate = new Date(event.date)
      } else if (event.date?.toDate) {
        eventDate = event.date.toDate()
      } else if (typeof event.date === 'string') {
        eventDate = new Date(event.date)
      } else {
        return false
      }
      
      // 날짜 비교 (시간 제외)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const weekFromNow = addDays(today, 7)
      eventDate.setHours(0, 0, 0, 0)
      
      return eventDate >= today && eventDate <= weekFromNow
    })
    .sort((a, b) => {
      const dateA = a.date instanceof Date ? a.date : (a.date?.toDate ? a.date.toDate() : new Date(a.date))
      const dateB = b.date instanceof Date ? b.date : (b.date?.toDate ? b.date.toDate() : new Date(b.date))
      return dateA - dateB
    })
    .slice(0, 5)


  // 참여중인 모임 (승인된 모임만)
  const joinedMeetings = meetings.filter(meeting => 
    meeting.participants.some(p => 
      p.userId === currentUser?.uid && 
      (p.status === 'approved' || p.status === 'owner')
    )
  ).slice(0, 4)

  // 중요 공지사항 (모든 모임의 공지사항 중 우선순위가 높은 것들)
  const importantAnnouncements = meetings
    .flatMap(meeting => 
      meeting.announcements?.map(announcement => ({
        ...announcement,
        meetingTitle: meeting.title,
        meetingId: meeting.id
      })) || []
    )
    .filter(announcement => announcement.priority === 'high' || announcement.priority === 'urgent')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 3)

  // 이번 주 캘린더 데이터 (오늘 날짜 기준)
  const today = new Date()
  const weekStart = startOfWeek(today, { weekStartsOn: 1 }) // 월요일 시작
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 })
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })


  // 날짜 포맷팅 헬퍼
  const formatDate = (date) => {
    if (isToday(date)) return '오늘'
    if (isTomorrow(date)) return '내일'
    if (isYesterday(date)) return '어제'
    return format(date, 'M/d', { locale: ko })
  }

  // 시간 포맷팅 헬퍼
  const formatTime = (date) => {
    return format(date, 'HH:mm', { locale: ko })
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* 환영 메시지 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-kaist-blue to-kaist-lightblue rounded-lg sm:rounded-xl p-4 sm:p-5 text-white"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-xl font-bold mb-1">
              안녕하세요! 👋
            </h1>
            <p className="text-blue-100 text-xs sm:text-sm">
              {currentUser?.displayName || currentUser?.email || '사용자'}님의 대시보드
            </p>
            <p className="text-xs text-blue-200 mt-1">
              {format(currentTime, 'M월 d일 EEEE', { locale: ko })} {formatTime(currentTime)}
            </p>
          </div>
          <div className="text-center sm:text-right">
            <div className="text-xl sm:text-2xl font-bold">
              {upcomingEvents.length}
            </div>
            <div className="text-xs text-blue-200">
              다가오는 일정
            </div>
          </div>
        </div>
      </motion.div>

      {/* 메인 컨텐츠 그리드 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
        {/* 왼쪽: 축소된 캘린더 */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-1"
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base sm:text-lg font-bold text-gray-800 dark:text-white flex items-center">
                <CalendarIcon className="w-4 h-4 mr-1.5 text-kaist-blue" />
                이번 주
              </h2>
              <button
                onClick={() => onViewChange('schedule')}
                className="text-xs text-kaist-blue hover:text-kaist-lightblue transition-colors"
              >
                전체 보기
              </button>
            </div>

            {/* 주간 캘린더 */}
            <div className="space-y-1.5">
              {weekDays.map((day, index) => {
                const dayEvents = getEventsForDate(day)
                const isSelected = day.toDateString() === selectedDate.toDateString()
                const isTodayDate = isToday(day)
                
                return (
                  <motion.div
                    key={day.toISOString()}
                    whileHover={{ scale: 1.01 }}
                    onClick={() => handleDateClick(day)}
                    className={`p-2 sm:p-2.5 rounded-lg cursor-pointer transition-all duration-200 ${
                      isSelected
                        ? 'bg-kaist-blue text-white shadow-md'
                        : isTodayDate
                        ? 'bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-300 dark:border-blue-700'
                        : 'bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className={`text-sm font-medium ${
                          isSelected ? 'text-white' : isTodayDate ? 'text-blue-700 dark:text-blue-300 font-bold' : 'text-gray-600 dark:text-gray-300'
                        }`}>
                          {format(day, 'E', { locale: ko })}
                          {isTodayDate && !isSelected && <span className="ml-1 text-xs">(오늘)</span>}
                        </div>
                        <div className={`text-lg font-bold ${
                          isSelected ? 'text-white' : isTodayDate ? 'text-blue-800 dark:text-blue-200' : 'text-gray-800 dark:text-white'
                        }`}>
                          {format(day, 'd')}
                        </div>
                        <div className={`text-xs mt-0.5 ${
                          isSelected ? 'text-blue-100' : isTodayDate ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          {format(day, 'M월 d일', { locale: ko })}
                        </div>
                      </div>
                      {dayEvents.length > 0 && (
                        <div className={`flex items-center space-x-1 ${
                          isSelected ? 'text-white' : 'text-kaist-blue'
                        }`}>
                          <div className="w-2 h-2 bg-current rounded-full"></div>
                          <span className="text-xs font-medium">{dayEvents.length}</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>
        </motion.div>

        {/* 오른쪽: 정보 카드들 */}
        <div className="lg:col-span-2 space-y-3 sm:space-y-4">
          {/* 중요 공지사항 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-gray-800 rounded-lg sm:rounded-xl p-4 sm:p-5 border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center justify-between mb-3">
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => onViewChange('meetings')}
                className="flex items-center text-base sm:text-lg font-bold text-gray-800 dark:text-white hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
              >
                <Bell className="w-4 h-4 mr-1.5 text-red-500" />
                중요 공지사항
              </motion.button>
              <div className="flex items-center text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                <AlertCircle className="w-3 h-3 mr-1" />
                {importantAnnouncements.length}개
              </div>
            </div>

            <div className="space-y-2">
              {importantAnnouncements.length > 0 ? (
                importantAnnouncements.map((announcement) => (
                  <motion.div
                    key={announcement.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      console.log('중요 공지사항 클릭:', announcement)
                      // 해당 모임 찾기 (meetingId 사용)
                      const meeting = meetings.find(m => m.id === announcement.meetingId)
                      console.log('찾은 모임:', meeting)
                      if (meeting && onMeetingClick) {
                        console.log('모임 클릭 핸들러 호출')
                        onMeetingClick(meeting)
                      } else {
                        console.log('모임을 찾을 수 없거나 핸들러가 없음')
                      }
                    }}
                    className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/30 transition-all duration-200"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 pr-2 sm:pr-4 min-w-0">
                        <div className="flex items-center space-x-1.5 sm:space-x-2 mb-1.5 flex-wrap">
                          <span className="text-xs px-1.5 py-0.5 bg-red-500 text-white rounded-full font-medium">
                            긴급
                          </span>
                          <span className="text-xs sm:text-sm text-red-600 dark:text-red-400 font-medium truncate">
                            {announcement.meetingTitle}
                          </span>
                        </div>
                        <h3 className="font-semibold text-sm sm:text-base text-red-800 dark:text-red-200 mb-1 truncate">
                          {announcement.title}
                        </h3>
                        <p className="text-xs sm:text-sm text-red-600 dark:text-red-400 line-clamp-2">
                          {announcement.content}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-red-400 mt-1 flex-shrink-0" />
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>중요한 공지사항이 없습니다</p>
                </div>
              )}
            </div>
          </motion.div>

          {/* 다가오는 일정 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-gray-800 rounded-lg sm:rounded-xl p-4 sm:p-5 border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center justify-between mb-3">
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => onViewChange('schedule')}
                className="flex items-center text-base sm:text-lg font-bold text-gray-800 dark:text-white hover:text-green-600 dark:hover:text-green-400 transition-colors cursor-pointer"
              >
                <Clock className="w-4 h-4 mr-1.5 text-green-500" />
                다가오는 일정
              </motion.button>
              <button
                onClick={() => onEventClick()}
                className="text-xs sm:text-sm text-kaist-blue hover:text-kaist-lightblue transition-colors"
              >
                일정 추가
              </button>
            </div>

            <div className="space-y-2">
              {upcomingEvents.length > 0 ? (
                upcomingEvents.map((event) => (
                  <motion.div
                    key={event.id}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => onEventClick(event)}
                    className="p-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 sm:space-x-3 flex-1 pr-2 sm:pr-4">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm sm:text-base text-gray-800 dark:text-white truncate">
                            {event.title}
                          </h3>
                          <div className="flex items-center space-x-1.5 sm:space-x-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400 flex-wrap">
                            <span>{formatDate(event.date instanceof Date ? event.date : (event.date?.toDate ? event.date.toDate() : new Date(event.date)))}</span>
                            {event.time && <span>• {event.time}</span>}
                            {event.location && (
                              <>
                                <span>•</span>
                                <div className="flex items-center">
                                  <MapPin className="w-3 h-3 mr-1" />
                                  <span>{event.location}</span>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>다가오는 일정이 없습니다</p>
                  <button
                    onClick={() => onEventClick()}
                    className="mt-3 text-kaist-blue hover:text-kaist-lightblue transition-colors"
                  >
                    첫 번째 일정을 추가해보세요
                  </button>
                </div>
              )}
            </div>
          </motion.div>

          {/* 참여중인 모임 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white dark:bg-gray-800 rounded-lg sm:rounded-xl p-4 sm:p-5 border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center justify-between mb-3">
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => onViewChange('meetings')}
                className="flex items-center text-base sm:text-lg font-bold text-gray-800 dark:text-white hover:text-purple-600 dark:hover:text-purple-400 transition-colors cursor-pointer"
              >
                <Users className="w-4 h-4 mr-1.5 text-purple-500" />
                참여중인 모임
              </motion.button>
              <div className="flex items-center text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                <CheckCircle className="w-3 h-3 mr-1" />
                {joinedMeetings.length}개
              </div>
            </div>

            <div className="space-y-2">
              {joinedMeetings.length > 0 ? (
                joinedMeetings.map((meeting) => (
                  <motion.div
                    key={meeting.id}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      if (import.meta.env.DEV) {
                        console.log('참여중인 모임 클릭:', meeting)
                      }
                      if (onMeetingClick) {
                        onMeetingClick(meeting)
                      }
                    }}
                    className="p-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 sm:space-x-3 flex-1 pr-2 sm:pr-4 min-w-0">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-purple-400 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Users className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm sm:text-base text-gray-800 dark:text-white truncate">
                            {meeting.title}
                          </h3>
                          <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2 space-y-0.5 sm:space-y-0 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                            <div className="flex items-center space-x-1 md:space-x-2">
                              <span className="capitalize">{meeting.type}</span>
                              <span className="hidden md:inline">•</span>
                              <span>{meeting.participants.filter(p => p.status === 'approved' || p.status === 'owner').length}명 참여</span>
                            </div>
                            {meeting.location && (
                              <div className="flex items-center">
                                <MapPin className="w-3 h-3 mr-1 flex-shrink-0" />
                                <span className="truncate">{meeting.location}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="text-center py-6 md:py-8 text-gray-500 dark:text-gray-400">
                  <Users className="w-8 h-8 md:w-12 md:h-12 mx-auto mb-2 md:mb-3 opacity-50" />
                  <p className="text-sm md:text-base">참여중인 모임이 없습니다</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* 하단 통계 카드 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3"
      >
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 sm:p-3 text-center border border-gray-200 dark:border-gray-700">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center mx-auto mb-1.5 sm:mb-2">
            <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">
            {events.length}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            총 일정
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center border border-gray-200 dark:border-gray-700">
          <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center mx-auto mb-2">
            <Users className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <div className="text-2xl font-bold text-gray-800 dark:text-white">
            {joinedMeetings.length}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            참여 모임
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center border border-gray-200 dark:border-gray-700">
          <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-lg flex items-center justify-center mx-auto mb-2">
            <Bell className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
          <div className="text-2xl font-bold text-gray-800 dark:text-white">
            {importantAnnouncements.length}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            중요 공지
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center border border-gray-200 dark:border-gray-700">
          <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center mx-auto mb-2">
            <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-gray-800 dark:text-white">
            {upcomingEvents.length}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            이번 주 일정
          </div>
        </div>
      </motion.div>

      {/* 날짜별 일정 목록 모달 */}
      {showDateEvents && selectedDateForEvents && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4"
          onClick={() => setShowDateEvents(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white dark:bg-gray-800 rounded-lg sm:rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-kaist-blue rounded-xl flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {format(selectedDateForEvents, 'yyyy년 M월 d일 (E)', { locale: ko })}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {getEventsForDate(selectedDateForEvents).length}개의 일정
                  </p>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowDateEvents(false)}
                className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </motion.button>
            </div>

            {/* 일정 목록 */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              {getEventsForDate(selectedDateForEvents).length === 0 ? (
                <div className="text-center py-8 sm:py-12">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Calendar className="w-6 h-6 sm:w-7 sm:h-7 text-gray-400" />
                  </div>
                  <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white mb-2">이 날에는 일정이 없습니다</h3>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-3 sm:mb-4">
                    새로운 일정을 추가해보세요
                  </p>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setShowDateEvents(false)
                      onEventClick({ date: selectedDateForEvents })
                    }}
                    className="btn-primary"
                  >
                    일정 추가하기
                  </motion.button>
                </div>
              ) : (
                <div className="space-y-2 sm:space-y-3">
                  {getEventsForDate(selectedDateForEvents).map((event) => (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ scale: 1.02 }}
                      onClick={() => {
                        setShowDateEvents(false)
                        onEventClick(event)
                      }}
                      className="p-4 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl cursor-pointer hover:shadow-md transition-all duration-200"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3 flex-1 pr-4">
                          <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-lg flex items-center justify-center">
                            <Calendar className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-800 dark:text-white">
                              {event.title}
                            </h3>
                            <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                              {event.time && <span>• {event.time}</span>}
                              {event.location && (
                                <>
                                  <span>•</span>
                                  <div className="flex items-center">
                                    <MapPin className="w-3 h-3 mr-1" />
                                    <span>{event.location}</span>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}

export default memo(Dashboard)
