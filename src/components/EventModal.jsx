import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Calendar, Clock, MapPin, Users, Tag, Save, Trash2, Building, Search, Repeat, Zap } from 'lucide-react'
import { format, addHours, addDays, addWeeks, addMonths } from 'date-fns'
import { ko } from 'date-fns/locale'
import { allBuildings, buildingTypes, getBuildingById } from '../data/buildings'
import { useToast } from '../contexts/ToastContext'

const EventModal = ({ event, onSave, onDelete, onClose }) => {
  const toast = useToast()
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    endTime: '',
    location: '',
    buildingId: '',
    participants: '',
    category: 'meeting',
    priority: 'medium',
    isRecurring: false,
    recurrenceType: 'none', // 'none', 'daily', 'weekly', 'monthly'
    recurrenceEndDate: ''
  })
  const [showCampusMap, setShowCampusMap] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [duration, setDuration] = useState(60) // 기본 1시간

  useEffect(() => {
    if (event) {
      const eventDate = event.date ? new Date(event.date) : null
      const endTime = event.endTime || ''
      
      setFormData({
        title: event.title || '',
        description: event.description || '',
        date: eventDate ? format(eventDate, 'yyyy-MM-dd') : '',
        time: event.time || '',
        endTime: endTime,
        location: event.location || '',
        buildingId: event.buildingId || '',
        participants: event.participants || '',
        category: event.category || 'meeting',
        priority: event.priority || 'medium',
        isRecurring: event.isRecurring || false,
        recurrenceType: event.recurrenceType || 'none',
        recurrenceEndDate: event.recurrenceEndDate || ''
      })
      
      // 종료 시간이 있으면 duration 계산
      if (event.time && endTime) {
        const start = new Date(`2000-01-01T${event.time}`)
        const end = new Date(`2000-01-01T${endTime}`)
        const diffMinutes = (end - start) / (1000 * 60)
        if (diffMinutes > 0) {
          setDuration(diffMinutes)
        }
      }
    } else {
      // Reset form for new event (간편화된 기본값)
      const today = new Date()
      const defaultTime = '14:00' // 기본 오후 2시
      const defaultEndTime = '15:00' // 기본 1시간 후
      
      setFormData({
        title: '',
        description: '',
        date: today.toISOString().split('T')[0], // 오늘 날짜로 기본 설정
        time: defaultTime,
        endTime: defaultEndTime,
        location: '',
        buildingId: '',
        participants: '',
        category: 'personal', // 개인 일정으로 기본 설정
        priority: 'medium',
        isRecurring: false,
        recurrenceType: 'none',
        recurrenceEndDate: ''
      })
      setDuration(60)
    }
  }, [event])
  
  // duration 변경 시 종료 시간 자동 계산
  useEffect(() => {
    if (formData.time && duration > 0) {
      const [hours, minutes] = formData.time.split(':').map(Number)
      const startDate = new Date(2000, 0, 1, hours, minutes)
      const endDate = new Date(startDate.getTime() + duration * 60000)
      const endTimeString = `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`
      setFormData(prev => ({ ...prev, endTime: endTimeString }))
    }
  }, [formData.time, duration])

  const handleSubmit = (e) => {
    e.preventDefault()
    
    // 필수 필드 검증 (간편화)
    if (!formData.title.trim()) {
      toast.showWarning('제목을 입력해주세요.')
      return
    }
    
    // 날짜가 없으면 오늘 날짜로 설정
    if (!formData.date) {
      const today = new Date()
      formData.date = today.toISOString().split('T')[0]
    }
    
    // 시간은 선택사항으로 변경
    // if (!formData.time) {
    //   alert('시간을 입력해주세요.')
    //   return
    // }
    
    try {
      // 날짜와 시간을 결합하여 유효한 Date 객체 생성
      let eventDate
      
      if (formData.date instanceof Date) {
        // 이미 Date 객체인 경우
        eventDate = new Date(formData.date)
        if (formData.time) {
          const [hours, minutes] = formData.time.split(':')
          eventDate.setHours(parseInt(hours), parseInt(minutes), 0, 0)
        }
      } else {
        // 문자열인 경우
        if (formData.time) {
          const dateTimeString = `${formData.date}T${formData.time}:00`
          eventDate = new Date(dateTimeString)
        } else {
          // 시간이 없으면 날짜만으로 설정
          eventDate = new Date(formData.date)
        }
      }
      
      // 유효한 날짜인지 확인
      if (isNaN(eventDate.getTime())) {
        toast.showWarning('올바른 날짜와 시간을 입력해주세요.')
        return
      }
      
      const eventData = {
        ...formData,
        id: event?.id,
        date: eventDate,
        endTime: formData.endTime || '',
        duration: duration,
        isRecurring: formData.isRecurring,
        recurrenceType: formData.recurrenceType,
        recurrenceEndDate: formData.recurrenceEndDate || '',
        // buildingId가 있으면 location을 건물명으로 설정
        location: formData.buildingId ? formData.location : formData.location
      }
      
      if (import.meta.env.DEV) {
        console.log('일정 저장 데이터:', eventData)
      }
      onSave(eventData)
      onClose()
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('일정 데이터 처리 오류:', error)
      }
      toast.showError('일정 데이터 처리 중 오류가 발생했습니다: ' + error.message)
    }
  }

  const handleDelete = () => {
    if (onDelete && event) {
      onDelete()
      onClose()
    }
  }

  const categories = [
    { value: 'meeting', label: '회의', color: 'bg-blue-100 text-blue-800' },
    { value: 'study', label: '스터디', color: 'bg-green-100 text-green-800' },
    { value: 'exam', label: '시험', color: 'bg-red-100 text-red-800' },
    { value: 'assignment', label: '과제', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'social', label: '모임', color: 'bg-purple-100 text-purple-800' },
    { value: 'personal', label: '개인', color: 'bg-gray-100 text-gray-800' }
  ]

  const priorities = [
    { value: 'low', label: '낮음', color: 'bg-green-100 text-green-800' },
    { value: 'medium', label: '보통', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'high', label: '높음', color: 'bg-red-100 text-red-800' }
  ]

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="bg-white dark:bg-gray-800 rounded-lg sm:rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-kaist-blue to-kaist-lightblue rounded-xl flex items-center justify-center">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-kaist-blue">
                  {event ? '일정 수정' : '새 일정 추가'}
                </h2>
                <p className="text-sm text-gray-600">
                  {event ? '일정 정보를 수정하세요' : '새로운 일정을 추가하세요'}
                </p>
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </motion.button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 sm:space-y-5">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                제목 *
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="input-field"
                placeholder="일정 제목을 입력하세요"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                설명
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="input-field min-h-[100px] resize-none"
                placeholder="일정에 대한 자세한 설명을 입력하세요"
              />
            </div>

            {/* 빠른 시간 선택 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                빠른 시간 선택
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: '오늘 오후 2시', date: new Date(), time: '14:00' },
                  { label: '오늘 오후 4시', date: new Date(), time: '16:00' },
                  { label: '내일 오전 10시', date: addDays(new Date(), 1), time: '10:00' },
                  { label: '내일 오후 2시', date: addDays(new Date(), 1), time: '14:00' }
                ].map((quickTime, idx) => (
                  <motion.button
                    key={idx}
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setFormData({
                        ...formData,
                        date: format(quickTime.date, 'yyyy-MM-dd'),
                        time: quickTime.time
                      })
                      setDuration(60)
                    }}
                    className="px-3 py-2 text-xs sm:text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors flex items-center justify-center space-x-1"
                  >
                    <Zap className="w-3 h-3" />
                    <span>{quickTime.label}</span>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Date and Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  날짜 *
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="input-field pl-10 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  시작 시간 *
                </label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="time"
                    required
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    className="input-field pl-10 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Duration and End Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  일정 길이
                </label>
                <select
                  value={duration}
                  onChange={(e) => {
                    const newDuration = parseInt(e.target.value)
                    setDuration(newDuration)
                  }}
                  className="input-field dark:bg-gray-700 dark:text-white"
                >
                  <option value={30}>30분</option>
                  <option value={60}>1시간</option>
                  <option value={90}>1시간 30분</option>
                  <option value={120}>2시간</option>
                  <option value={180}>3시간</option>
                  <option value={240}>4시간</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  종료 시간
                </label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => {
                      setFormData({ ...formData, endTime: e.target.value })
                      // 종료 시간 변경 시 duration 재계산
                      if (formData.time) {
                        const [startH, startM] = formData.time.split(':').map(Number)
                        const [endH, endM] = e.target.value.split(':').map(Number)
                        const start = new Date(2000, 0, 1, startH, startM)
                        const end = new Date(2000, 0, 1, endH, endM)
                        const diffMinutes = (end - start) / (1000 * 60)
                        if (diffMinutes > 0) {
                          setDuration(diffMinutes)
                        }
                      }
                    }}
                    className="input-field pl-10 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* 반복 일정 설정 */}
            <div>
              <label className="flex items-center space-x-2 mb-2">
                <input
                  type="checkbox"
                  checked={formData.isRecurring}
                  onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked, recurrenceType: e.target.checked ? 'weekly' : 'none' })}
                  className="w-4 h-4 text-kaist-blue rounded focus:ring-kaist-blue"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                  <Repeat className="w-4 h-4 mr-1" />
                  반복 일정
                </span>
              </label>
              
              {formData.isRecurring && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-3 space-y-3"
                >
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      반복 주기
                    </label>
                    <select
                      value={formData.recurrenceType}
                      onChange={(e) => setFormData({ ...formData, recurrenceType: e.target.value })}
                      className="input-field dark:bg-gray-700 dark:text-white"
                    >
                      <option value="daily">매일</option>
                      <option value="weekly">매주</option>
                      <option value="monthly">매월</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      반복 종료일 (선택사항)
                    </label>
                    <input
                      type="date"
                      value={formData.recurrenceEndDate}
                      onChange={(e) => setFormData({ ...formData, recurrenceEndDate: e.target.value })}
                      className="input-field dark:bg-gray-700 dark:text-white"
                      min={formData.date}
                    />
                  </div>
                </motion.div>
              )}
            </div>

            {/* Building Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                장소 선택
              </label>
              
              {/* 건물 선택 버튼 */}
              <div className="flex space-x-2 mb-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowCampusMap(!showCampusMap)}
                  className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 rounded-xl border-2 transition-all duration-300 ${
                    showCampusMap 
                      ? 'border-kaist-blue bg-blue-50 text-kaist-blue' 
                      : 'border-gray-300 hover:border-kaist-blue'
                  }`}
                >
                  <MapPin className="w-4 h-4" />
                  <span>캠퍼스맵에서 선택</span>
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setShowCampusMap(false)
                    setFormData({ ...formData, buildingId: '', location: '' })
                  }}
                  className="px-4 py-3 border-2 border-gray-300 rounded-xl hover:border-gray-400 transition-all duration-300"
                >
                  직접 입력
                </motion.button>
              </div>

              {/* 캠퍼스맵 인터페이스 */}
              {showCampusMap && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="border border-gray-200 rounded-xl p-4 bg-gray-50"
                >
                  {/* 검색 및 필터 */}
                  <div className="mb-4 space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="건물 검색..."
                        className="input-field pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    
                    <div className="relative">
                      <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="input-field pl-10"
                      >
                        <option value="all">모든 타입</option>
                        {buildingTypes && Object.entries(buildingTypes).map(([type, info]) => (
                          <option key={type} value={type}>{info.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* 캠퍼스맵 이미지와 건물 목록 */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* 캠퍼스맵 이미지 */}
                    <div className="relative">
                      <img
                        src="/SCR-20250921-blps.jpeg"
                        alt="KAIST 캠퍼스맵"
                        className="w-full h-64 object-contain rounded-lg border border-gray-200"
                        onError={(e) => {
                          e.target.style.display = 'none'
                          e.target.nextElementSibling.style.display = 'block'
                        }}
                      />
                      <div className="hidden w-full h-64 bg-gradient-to-br from-green-50 via-blue-50 to-purple-50 rounded-lg border border-gray-200 flex items-center justify-center">
                        <p className="text-gray-500">캠퍼스맵 이미지</p>
                      </div>
                    </div>

                    {/* 건물 목록 */}
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {allBuildings && allBuildings
                        .filter(building => {
                          const matchesSearch = building.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                                building.englishName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                                building.id.toLowerCase().includes(searchTerm.toLowerCase())
                          const matchesType = filterType === 'all' || building.type === filterType
                          return matchesSearch && matchesType
                        })
                        .map(building => (
                          <motion.div
                            key={building.id}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                              try {
                                const buildingData = getBuildingById(building.id)
                                setFormData({ 
                                  ...formData, 
                                  buildingId: building.id, 
                                  location: buildingData ? buildingData.name : ''
                                })
                              } catch (error) {
                                console.error('건물 선택 오류:', error)
                                setFormData({ 
                                  ...formData, 
                                  buildingId: building.id, 
                                  location: building.name
                                })
                              }
                            }}
                            className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                              formData.buildingId === building.id
                                ? 'border-kaist-blue bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                              <div className="flex items-center space-x-2">
                                <div 
                                  className="w-3 h-3 rounded-full" 
                                  style={{ backgroundColor: buildingTypes?.[building.type]?.color || '#6B7280' }}
                                ></div>
                                <span className="font-medium text-sm">{building.id}</span>
                                <span className="text-sm text-gray-600">{building.name}</span>
                              </div>
                            <p className="text-xs text-gray-500 mt-1">{building.englishName}</p>
                          </motion.div>
                        ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* 직접 입력 필드 */}
              {!showCampusMap && (
                <div className="space-y-3">
                  <div className="relative">
                    <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <select
                      value={formData.buildingId}
                      onChange={(e) => {
                        try {
                          const building = getBuildingById(e.target.value)
                          setFormData({ 
                            ...formData, 
                            buildingId: e.target.value,
                            location: building ? building.name : ''
                          })
                        } catch (error) {
                          console.error('건물 선택 오류:', error)
                          setFormData({ 
                            ...formData, 
                            buildingId: e.target.value,
                            location: ''
                          })
                        }
                      }}
                      className="input-field pl-10"
                    >
                      <option value="">건물을 선택하세요</option>
                      {allBuildings && allBuildings.map(building => (
                        <option key={building.id} value={building.id}>
                          {building.id} - {building.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {formData.buildingId && (
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <div 
                          className="w-4 h-4 rounded-full" 
                          style={{ backgroundColor: buildingTypes?.[getBuildingById(formData.buildingId)?.type]?.color || '#6B7280' }}
                        ></div>
                        <span className="text-sm text-blue-800">
                          {getBuildingById(formData.buildingId)?.englishName || '알 수 없는 건물'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Location and Participants */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  상세 장소
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="input-field pl-10"
                    placeholder="상세 장소를 입력하세요 (예: 강의실, 회의실)"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  참석자
                </label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={formData.participants}
                    onChange={(e) => setFormData({ ...formData, participants: e.target.value })}
                    className="input-field pl-10"
                    placeholder="참석자들을 입력하세요"
                  />
                </div>
              </div>
            </div>

            {/* Category and Priority */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  카테고리
                </label>
                <div className="relative">
                  <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="input-field pl-10"
                  >
                    {categories.map(cat => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  우선순위
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  className="input-field"
                >
                  {priorities.map(priority => (
                    <option key={priority.value} value={priority.value}>
                      {priority.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-6 border-t border-gray-200">
              <div className="flex items-center space-x-3">
                {event && onDelete && (
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleDelete}
                    className="flex items-center space-x-1 md:space-x-2 px-3 md:px-4 py-2 bg-red-100 text-red-700 rounded-xl hover:bg-red-200 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden md:inline">삭제</span>
                  </motion.button>
                )}
              </div>
              
              <div className="flex items-center space-x-3">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onClose}
                  className="btn-secondary px-3 md:px-4 py-2"
                >
                  <span className="hidden md:inline">취소</span>
                  <span className="md:hidden">✕</span>
                </motion.button>
                
                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="btn-primary flex items-center space-x-1 md:space-x-2 px-3 md:px-4 py-2"
                >
                  <Save className="w-4 h-4" />
                  <span className="hidden md:inline">{event ? '수정' : '저장'}</span>
                </motion.button>
              </div>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default EventModal
