import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Calendar, Clock, Users, MapPin, CheckCircle, XCircle } from 'lucide-react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

const TimeCoordination = ({ meeting, currentUser, onAvailabilityChange, onBack, onComplete, isMobileModal = false }) => {
  const [availableMode, setAvailableMode] = useState(true) // true: 가능한 시간, false: 불가능한 시간
  const [availableSlots, setAvailableSlots] = useState([]) // 가능한 시간 슬롯
  const [unavailableSlots, setUnavailableSlots] = useState([]) // 불가능한 시간 슬롯
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState(null)

  // 로그인하지 않은 사용자 체크
  if (!currentUser || !currentUser.uid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="glass-effect rounded-2xl p-8 shadow-xl text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">
            로그인이 필요합니다
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            시간 조율 기능을 사용하려면 로그인해주세요.
          </p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onBack}
            className="btn-primary"
          >
            돌아가기
          </motion.button>
        </div>
      </div>
    )
  }

  // 현재 사용자의 가용성 초기화
  useEffect(() => {
    if (meeting && currentUser && currentUser.uid && meeting.availability && meeting.availability[currentUser.uid]) {
      const userAvailability = meeting.availability[currentUser.uid]
      // 배열인지 확인하고, 아니면 빈 배열로 설정
      const availabilityArray = Array.isArray(userAvailability) ? userAvailability : []
      // 기존 데이터를 가능한 시간과 불가능한 시간으로 분리
      // 현재는 모든 선택된 슬롯을 가능한 시간으로 간주
      setAvailableSlots(availabilityArray)
      setUnavailableSlots([])
    }
  }, [meeting, currentUser])

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

  // 요일별 시간 슬롯 생성 (실제 날짜 사용)
  const weekDays = ['월', '화', '수', '목', '금']
  const today = new Date()
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - today.getDay() + 1) // 월요일로 설정
  
  const weekDates = weekDays.map((_, index) => {
    const date = new Date(weekStart)
    date.setDate(weekStart.getDate() + index)
    return format(date, 'M.dd', { locale: ko })
  })

  // 시간 슬롯 선택/해제
  const toggleTimeSlot = (dayIndex, slotId) => {
    const fullSlotId = `${dayIndex}-${slotId}`
    
    if (availableMode) {
      // 가능한 시간 모드
      const newAvailableSlots = availableSlots.includes(fullSlotId)
        ? availableSlots.filter(id => id !== fullSlotId)
        : [...availableSlots, fullSlotId]
      
      // 불가능한 시간에서 제거 (중복 방지)
      const newUnavailableSlots = unavailableSlots.filter(id => id !== fullSlotId)
      
      setAvailableSlots(newAvailableSlots)
      setUnavailableSlots(newUnavailableSlots)
      
      // 전체 선택된 슬롯을 부모에게 전달 (배열인지 확인)
      if (Array.isArray(newAvailableSlots)) {
        onAvailabilityChange(newAvailableSlots)
      }
    } else {
      // 불가능한 시간 모드
      const newUnavailableSlots = unavailableSlots.includes(fullSlotId)
        ? unavailableSlots.filter(id => id !== fullSlotId)
        : [...unavailableSlots, fullSlotId]
      
      // 가능한 시간에서 제거 (중복 방지)
      const newAvailableSlots = availableSlots.filter(id => id !== fullSlotId)
      
      setAvailableSlots(newAvailableSlots)
      setUnavailableSlots(newUnavailableSlots)
      
      // 가능한 시간만 부모에게 전달 (배열인지 확인)
      if (Array.isArray(newAvailableSlots)) {
        onAvailabilityChange(newAvailableSlots)
      }
    }
  }

  // 드래그 시작
  const handleMouseDown = (e, dayIndex, slotId) => {
    e.preventDefault()
    setIsDragging(true)
    setDragStart({ dayIndex, slotId })
    toggleTimeSlot(dayIndex, slotId)
  }

  // 드래그 중
  const handleMouseEnter = (dayIndex, slotId) => {
    if (isDragging && dragStart) {
      // 같은 날짜의 연속된 슬롯들만 선택 가능
      const startSlot = timeSlots.findIndex(slot => slot.id === dragStart.slotId)
      const currentSlot = timeSlots.findIndex(slot => slot.id === slotId)
      
      if (dayIndex === dragStart.dayIndex && Math.abs(currentSlot - startSlot) <= 10) {
        toggleTimeSlot(dayIndex, slotId)
      }
    }
  }

  // 드래그 종료
  const handleMouseUp = () => {
    setIsDragging(false)
    setDragStart(null)
  }

  // 슬롯이 선택되었는지 확인
  const isSlotSelected = (dayIndex, slotId) => {
    const fullSlotId = `${dayIndex}-${slotId}`
    if (availableMode) {
      return availableSlots.includes(fullSlotId)
    } else {
      return unavailableSlots.includes(fullSlotId)
    }
  }

  // 슬롯 색상 결정
  const getSlotColor = (dayIndex, slotId) => {
    const fullSlotId = `${dayIndex}-${slotId}`
    const isAvailable = availableSlots.includes(fullSlotId)
    const isUnavailable = unavailableSlots.includes(fullSlotId)
    const isCurrentlySelected = isSlotSelected(dayIndex, slotId)
    
    // 불가능한 시간이면 분홍색
    if (isUnavailable) {
      return isCurrentlySelected 
        ? 'bg-pink-500 border-pink-600' 
        : 'bg-pink-100 border-pink-300 hover:bg-pink-200'
    }
    
    // 가능한 시간이면 파란색
    if (isAvailable) {
      return isCurrentlySelected 
        ? 'bg-blue-500 border-blue-600' 
        : 'bg-blue-100 border-blue-300 hover:bg-blue-200'
    }
    
    // 선택되지 않은 시간
    if (availableMode) {
      return isCurrentlySelected 
        ? 'bg-blue-500 border-blue-600' 
        : 'bg-white border-gray-200 hover:bg-blue-50'
    } else {
      return isCurrentlySelected 
        ? 'bg-pink-500 border-pink-600' 
        : 'bg-white border-gray-200 hover:bg-pink-50'
    }
  }

  return (
    <div className={isMobileModal ? "h-full bg-white dark:bg-gray-800" : "min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:to-gray-800"}>
      {/* Header - 모바일 모달에서는 숨김 */}
      {!isMobileModal && (
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
                시간 조율
              </h1>
              <p className="text-sm md:text-base text-gray-600 dark:text-gray-300 truncate">
                {meeting?.title} - 가능한 시간을 선택해주세요
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between md:justify-end space-x-3 md:space-x-4">
            <div className="flex items-center space-x-1 md:space-x-2">
              <Users className="w-4 h-4 md:w-5 md:h-5 text-gray-600 dark:text-gray-300" />
              <span className="text-xs md:text-sm text-gray-600 dark:text-gray-300">
                {meeting?.participants?.filter(p => p.status === 'approved' || p.status === 'owner').length || 0}명
              </span>
            </div>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onComplete}
              className="btn-primary flex items-center space-x-1 md:space-x-2 px-3 md:px-4 py-2 md:py-3"
            >
              <CheckCircle className="w-4 h-4" />
              <span className="hidden md:inline">완료</span>
            </motion.button>
          </div>
        </div>
      </div>
      )}

      {/* Main Content */}
      <div className={isMobileModal ? "h-full overflow-hidden" : "container mx-auto px-4 py-8"}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className={isMobileModal ? "h-full p-4 overflow-hidden" : "glass-effect rounded-2xl p-4 md:p-6 shadow-xl"}
        >
          {/* Mode Toggle */}
          <div className="mb-8">
            <div className="flex items-center justify-center space-x-4 md:space-x-8">
              {/* 가능한 시간 모드 */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setAvailableMode(true)}
                className={`flex items-center space-x-2 md:space-x-3 px-4 md:px-6 py-3 md:py-4 rounded-xl border-2 transition-all duration-300 ${
                  availableMode
                    ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-lg'
                    : 'border-gray-300 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:border-blue-300'
                }`}
              >
                <div className={`w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center ${
                  availableMode ? 'bg-blue-500' : 'bg-gray-300'
                }`}>
                  {availableMode && <CheckCircle className="w-3 h-3 md:w-4 md:h-4 text-white" />}
                </div>
                <span className="font-medium hidden md:inline">되는 시간 체크</span>
              </motion.button>

              {/* 불가능한 시간 모드 */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setAvailableMode(false)}
                className={`flex items-center space-x-2 md:space-x-3 px-4 md:px-6 py-3 md:py-4 rounded-xl border-2 transition-all duration-300 ${
                  !availableMode
                    ? 'border-pink-500 bg-pink-50 text-pink-700 shadow-lg'
                    : 'border-gray-300 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:border-pink-300'
                }`}
              >
                <div className={`w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center ${
                  !availableMode ? 'bg-pink-500' : 'bg-gray-300'
                }`}>
                  {!availableMode && <XCircle className="w-3 h-3 md:w-4 md:h-4 text-white" />}
                </div>
                <span className="font-medium hidden md:inline">안되는 시간 체크</span>
              </motion.button>
            </div>
          </div>

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
                <div 
                  className="max-h-96 overflow-y-auto"
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  {timeSlots.map((slot) => (
                    <div key={slot.id} className="grid grid-cols-6 border-b border-gray-100 dark:border-gray-700">
                      {/* Time Label */}
                      <div className="p-2 md:p-3 text-center text-xs md:text-sm text-gray-600 dark:text-gray-400 border-r border-gray-200 dark:border-gray-600 min-w-[80px]">
                        {slot.time}
                      </div>

                      {/* Day Columns */}
                      {weekDays.map((_, dayIndex) => (
                        <motion.div
                          key={dayIndex}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className={`p-2 md:p-3 border-r border-gray-200 dark:border-gray-600 last:border-r-0 cursor-pointer transition-all duration-200 min-w-[100px] ${getSlotColor(dayIndex, slot.id)}`}
                          onMouseDown={(e) => handleMouseDown(e, dayIndex, slot.id)}
                          onMouseEnter={() => handleMouseEnter(dayIndex, slot.id)}
                        >
                          <div className="w-full h-4 md:h-6 rounded border border-dashed border-gray-300 dark:border-gray-500"></div>
                        </motion.div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <Clock className="w-5 h-5 text-blue-500" />
              <span className="font-medium text-blue-700 dark:text-blue-300">사용 방법</span>
            </div>
            <ul className="text-sm text-blue-600 dark:text-blue-400 space-y-1">
              <li>• {availableMode ? '파란색' : '분홍색'} 모드에서 시간을 클릭하거나 드래그하여 선택하세요</li>
              <li>• 드래그로 연속된 시간대를 한 번에 선택할 수 있습니다</li>
              <li>• 파란색: 가능한 시간, 분홍색: 불가능한 시간으로 구분됩니다</li>
              <li>• 모드를 전환해도 기존 설정이 유지됩니다</li>
            </ul>
          </div>
        </motion.div>
      </div>

      {/* 모바일 모달용 완료 버튼 */}
      {isMobileModal && (
        <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onComplete}
            className="w-full bg-kaist-blue text-white rounded-xl py-3 px-4 font-medium flex items-center justify-center space-x-2"
          >
            <CheckCircle className="w-5 h-5" />
            <span>완료</span>
          </motion.button>
        </div>
      )}
    </div>
  )
}

export default TimeCoordination