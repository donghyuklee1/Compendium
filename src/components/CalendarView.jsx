import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Plus, Clock, MapPin, Users, Tag, Calendar as CalendarIcon, X, Edit3, Trash2 } from 'lucide-react'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths, isToday } from 'date-fns'
import { ko } from 'date-fns/locale'
import { createEvent, deleteEvent } from '../services/firestoreService'
import { useToast } from '../contexts/ToastContext'

const CalendarView = ({ events, onEventClick, onAddEvent, currentUser, selectedDate: propSelectedDate, setSelectedDate: propSetSelectedDate }) => {
  const toast = useToast()
  // 이벤트 데이터 디버깅
  if (import.meta.env.DEV) {
    console.log('CalendarView - 받은 이벤트 데이터:', events.length, '개 이벤트')
  }
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(propSelectedDate || new Date())

  // propSelectedDate가 변경될 때 로컬 selectedDate도 업데이트
  useEffect(() => {
    if (propSelectedDate) {
      setSelectedDate(propSelectedDate)
    }
  }, [propSelectedDate])
  const [showDateModal, setShowDateModal] = useState(false)
  const [showEventModal, setShowEventModal] = useState(false)
  const [editingEvent, setEditingEvent] = useState(null)
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    location: '',
    category: 'personal',
    priority: 'medium'
  })

  const categories = {
    meeting: { label: '회의', color: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-700' },
    study: { label: '스터디', color: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-700' },
    exam: { label: '시험', color: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-700' },
    assignment: { label: '과제', color: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-700' },
    social: { label: '모임', color: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-700' },
    personal: { label: '개인', color: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600' }
  }

  const priorities = {
    low: { label: '낮음', color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' },
    medium: { label: '보통', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300' },
    high: { label: '높음', color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300' }
  }

  // 달력 데이터 생성
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(monthStart)
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 })
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const getEventsForDate = (date) => {
    console.log('getEventsForDate 호출:', format(date, 'yyyy-MM-dd'))
    console.log('현재 사용자 ID:', currentUser?.uid)
    console.log('전체 이벤트:', events)
    
    const filteredEvents = events.filter(event => {
      const isUserMatch = event.userId === currentUser?.uid
      const isDateMatch = isSameDay(new Date(event.date), date)
      console.log(`이벤트 ${event.title}: userId=${event.userId}, date=${event.date}, 사용자매치=${isUserMatch}, 날짜매치=${isDateMatch}`)
      return isUserMatch && isDateMatch
    })
    
    console.log('필터링된 이벤트:', filteredEvents)
    return filteredEvents
  }

  const nextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1))
  }

  const prevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1))
  }

  const handleDateClick = (date) => {
    console.log('CalendarView - 날짜 클릭:', format(date, 'yyyy-MM-dd'))
    console.log('CalendarView - 날짜 객체:', date)
    console.log('CalendarView - 현재 selectedDate:', selectedDate)
    setSelectedDate(date)
    if (propSetSelectedDate) {
      propSetSelectedDate(date)
      console.log('CalendarView - 부모 컴포넌트에 날짜 전달:', format(date, 'yyyy-MM-dd'))
    }
    setShowDateModal(true)
  }

  const handleAddEvent = () => {
    console.log('CalendarView - 일정 추가, 선택된 날짜:', format(selectedDate, 'yyyy-MM-dd'))
    console.log('CalendarView - selectedDate 객체:', selectedDate)
    console.log('CalendarView - propSelectedDate:', propSelectedDate)
    const eventDate = format(selectedDate, 'yyyy-MM-dd')
    console.log('CalendarView - 이벤트 날짜 설정:', eventDate)
    setEventForm({
      title: '',
      description: '',
      date: eventDate,
      time: '',
      location: '',
      category: 'personal',
      priority: 'medium'
    })
    setEditingEvent(null)
    setShowEventModal(true)
  }

  const handleEditEvent = (event) => {
    setEventForm({
      title: event.title,
      description: event.description || '',
      date: format(new Date(event.date), 'yyyy-MM-dd'),
      time: event.time || '',
      location: event.location || '',
      category: event.category || 'personal',
      priority: event.priority || 'medium'
    })
    setEditingEvent(event)
    setShowEventModal(true)
  }

  const handleSaveEvent = async () => {
    if (!eventForm.title.trim()) {
      toast.showWarning('제목을 입력해주세요.')
      return
    }

    if (!currentUser || !currentUser.uid) {
      toast.showWarning('로그인이 필요합니다. 다시 로그인해주세요.')
      return
    }

    try {
      if (import.meta.env.DEV) {
        console.log('CalendarView - currentUser:', currentUser)
        console.log('CalendarView - currentUser.uid:', currentUser.uid)
      }
      const eventData = {
        ...eventForm,
        userId: currentUser.uid,
        createdAt: new Date().toISOString()
      }
      if (import.meta.env.DEV) {
        console.log('CalendarView - eventData:', eventData)
      }

      if (editingEvent) {
        // 기존 이벤트 업데이트 (deleteEvent + createEvent로 구현)
        await deleteEvent(editingEvent.id)
        await createEvent(eventData, currentUser.uid)
      } else {
        await createEvent(eventData, currentUser.uid)
      }

      console.log('일정 저장 성공!')
      toast.showSuccess('일정이 성공적으로 저장되었습니다.')
      
      setShowEventModal(false)
      setEventForm({
        title: '',
        description: '',
        date: '',
        time: '',
        location: '',
        category: 'personal',
        priority: 'medium'
      })
      setEditingEvent(null)
    } catch (error) {
      console.error('일정 저장 실패:', error)
      toast.showError('일정 저장에 실패했습니다: ' + error.message)
    }
  }

  const handleDeleteEvent = async (eventId) => {
    if (window.confirm('정말로 이 일정을 삭제하시겠습니까?')) {
      try {
        await deleteEvent(eventId)
        toast.showSuccess('일정이 성공적으로 삭제되었습니다.')
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('일정 삭제 실패:', error)
        }
        toast.showError('일정 삭제에 실패했습니다: ' + error.message)
      }
    }
  }

  // 달력 그리드 생성
  const renderCalendarGrid = () => {
    const rows = []
    let days = []
    let day = new Date(startDate)

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        const currentDay = new Date(day) // 새로운 Date 객체 생성
        const dayEvents = getEventsForDate(currentDay)
        const isCurrentMonth = isSameMonth(currentDay, monthStart)
        const isSelected = isSameDay(currentDay, selectedDate)
        const isTodayDate = isToday(currentDay)

        days.push(
          <motion.div
            key={format(currentDay, 'yyyy-MM-dd')} // 문자열로 key 설정
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`relative p-3 min-h-[120px] border-r border-b border-gray-200 dark:border-gray-700 cursor-pointer transition-all duration-300 ${
              isCurrentMonth 
                ? 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700' 
                : 'bg-gray-50 dark:bg-gray-900'
            } ${
              isSelected 
                ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-lg' 
                : ''
            } ${
              isTodayDate 
                ? 'bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/30 dark:to-blue-800/30 shadow-md' 
                : ''
            }`}
            onClick={() => {
              console.log('날짜 셀 클릭:', format(currentDay, 'yyyy-MM-dd'))
              handleDateClick(currentDay)
            }}
          >
            <div className={`text-sm font-medium mb-2 ${
              isCurrentMonth 
                ? 'text-gray-900 dark:text-gray-100' 
                : 'text-gray-400 dark:text-gray-500'
            } ${
              isTodayDate 
                ? 'text-blue-700 dark:text-blue-300 font-bold text-lg' 
                : ''
            } ${
              isSelected
                ? 'text-blue-600 dark:text-blue-400 font-bold'
                : ''
            }`}>
              {format(day, 'd')}
            </div>
            
            {/* 일정 표시 */}
            <div className="space-y-1">
              {dayEvents.slice(0, 3).map((event, index) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`text-xs p-1 rounded truncate cursor-pointer ${
                    categories[event.category]?.color || categories.personal.color
                  }`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onEventClick(event)
                  }}
                >
                  {event.time && `${event.time} `}{event.title}
                </motion.div>
              ))}
              {dayEvents.length > 3 && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  +{dayEvents.length - 3}개 더
                </div>
              )}
            </div>
          </motion.div>
        )
        day = addDays(day, 1)
      }
      rows.push(
        <div key={`week-${rows.length}`} className="grid grid-cols-7 gap-0">
          {days}
        </div>
      )
      days = []
    }
    return rows
  }

  return (
    <div className="space-y-6">
      {/* 달력 헤더 - 세련된 디자인 */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          {/* 이전 달 버튼 */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={prevMonth}
            className="p-3 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200 shadow-md"
          >
            <ChevronLeft className="w-6 h-6 text-gray-600 dark:text-gray-300" />
          </motion.button>

          {/* 연도/월 중앙 배치 */}
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
              {format(currentMonth, 'yyyy년 M월', { locale: ko })}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              날짜를 클릭하여 일정을 추가하세요
            </p>
          </div>

          {/* 다음 달 버튼 */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={nextMonth}
            className="p-3 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200 shadow-md"
          >
            <ChevronRight className="w-6 h-6 text-gray-600 dark:text-gray-300" />
          </motion.button>
        </div>

        {/* 오늘 버튼 */}
        <div className="flex justify-center">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setCurrentMonth(new Date())}
            className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-full font-medium transition-colors shadow-md"
          >
            오늘
          </motion.button>
        </div>
      </div>

      {/* 요일 헤더 - 세련된 디자인 */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="grid grid-cols-7">
          {['월', '화', '수', '목', '금', '토', '일'].map((day, index) => (
            <div key={day} className={`p-4 text-center font-semibold text-gray-600 dark:text-gray-400 ${
              index === 6 ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' : 
              index === 5 ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' :
              'bg-gray-50 dark:bg-gray-700'
            }`}>
              {day}
            </div>
          ))}
        </div>

        {/* 달력 그리드 */}
        <div className="space-y-0">
          {renderCalendarGrid()}
        </div>
      </div>

      {/* 날짜별 일정 모달 */}
      <AnimatePresence>
        {showDateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowDateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 50 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-2xl w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  {format(selectedDate, 'yyyy년 M월 d일 (E)', { locale: ko })}
                </h3>
                <button
                  onClick={() => setShowDateModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-3 mb-4">
                {getEventsForDate(selectedDate).map((event) => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-3 rounded-lg border ${
                      categories[event.category]?.color || categories.personal.color
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{event.title}</h4>
                        {event.time && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            <Clock className="w-3 h-3 inline mr-1" />
                            {event.time}
                          </p>
                        )}
                        {event.location && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            <MapPin className="w-3 h-3 inline mr-1" />
                            {event.location}
                          </p>
                        )}
                      </div>
                      <div className="flex space-x-1">
                        <button
                          onClick={() => handleEditEvent(event)}
                          className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteEvent(event.id)}
                          className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
                {getEventsForDate(selectedDate).length === 0 && (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                    등록된 일정이 없습니다.
                  </p>
                )}
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleAddEvent}
                className="w-full btn-primary flex items-center justify-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>일정 추가</span>
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 일정 추가/편집 모달 */}
      <AnimatePresence>
        {showEventModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowEventModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 50 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-2xl w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  {editingEvent ? '일정 수정' : '일정 추가'}
                </h3>
                <button
                  onClick={() => setShowEventModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    제목 *
                  </label>
                  <input
                    type="text"
                    value={eventForm.title}
                    onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                    className="w-full input-field"
                    placeholder="일정 제목을 입력하세요"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    설명
                  </label>
                  <textarea
                    value={eventForm.description}
                    onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                    className="w-full input-field h-20 resize-none"
                    placeholder="일정 설명을 입력하세요"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      날짜 *
                    </label>
                    <div className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white">
                      {format(new Date(eventForm.date), 'yyyy년 M월 d일 (E)', { locale: ko })}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      캘린더에서 선택한 날짜입니다
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      시간
                    </label>
                    <input
                      type="time"
                      value={eventForm.time}
                      onChange={(e) => setEventForm({ ...eventForm, time: e.target.value })}
                      className="w-full input-field"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    장소
                  </label>
                  <input
                    type="text"
                    value={eventForm.location}
                    onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                    className="w-full input-field"
                    placeholder="장소를 입력하세요"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      카테고리
                    </label>
                    <select
                      value={eventForm.category}
                      onChange={(e) => setEventForm({ ...eventForm, category: e.target.value })}
                      className="w-full input-field"
                    >
                      {Object.entries(categories).map(([key, value]) => (
                        <option key={key} value={key}>{value.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      우선순위
                    </label>
                    <select
                      value={eventForm.priority}
                      onChange={(e) => setEventForm({ ...eventForm, priority: e.target.value })}
                      className="w-full input-field"
                    >
                      {Object.entries(priorities).map(([key, value]) => (
                        <option key={key} value={key}>{value.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowEventModal(false)}
                  className="flex-1 btn-secondary"
                >
                  취소
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSaveEvent}
                  className="flex-1 btn-primary"
                >
                  {editingEvent ? '수정' : '추가'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default CalendarView
