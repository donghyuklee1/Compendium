import React, { useState, useEffect, Suspense, lazy } from 'react'
import { motion } from 'framer-motion'
import Header from './components/Header'
import Footer from './components/Footer'
import LandingPage from './components/LandingPage'
import { ToastProvider, useToast } from './contexts/ToastContext'
import { useRealtimeUpdates } from './hooks/useRealtimeUpdates'
import ErrorBoundary from './components/ErrorBoundary'

// 동적 import를 사용한 지연 로딩
const Calendar = lazy(() => import('./components/Calendar'))
const CalendarView = lazy(() => import('./components/CalendarView'))
const Dashboard = lazy(() => import('./components/Dashboard'))
const EventModal = lazy(() => import('./components/EventModal'))
const ScheduleGrid = lazy(() => import('./components/ScheduleGrid'))
const MeetingList = lazy(() => import('./components/MeetingList'))
const MeetingModal = lazy(() => import('./components/MeetingModal'))
const TimeCoordination = lazy(() => import('./components/TimeCoordination'))
const MeetingDetails = lazy(() => import('./components/MeetingDetails'))
const LoginPage = lazy(() => import('./components/LoginPage'))
const ProfilePage = lazy(() => import('./components/ProfilePage'))
const SettingsPage = lazy(() => import('./components/SettingsPage'))
import { Calendar as CalendarIcon, Grid, Users } from 'lucide-react'
import { getBuildingById } from './data/buildings'
import { useAuth } from './contexts/AuthContext'
import { checkFirebaseConnection } from './config/firebase'
import FirebaseSetupAlert from './components/FirebaseSetupAlert'
import { 
  subscribeToUserEvents, 
  subscribeToMeetings, 
  subscribeToUserNotifications,
  createEvent as createEventInFirestore, 
  updateEvent as updateEventInFirestore, 
  deleteEvent as deleteEventInFirestore, 
  createMeeting as createMeetingInFirestore, 
  updateMeeting as updateMeetingInFirestore, 
  deleteMeeting as deleteMeetingInFirestore,
  joinMeeting as joinMeetingInFirestore, 
  updateAvailability as updateAvailabilityInFirestore, 
  addAnnouncement as addAnnouncementInFirestore, 
  deleteAnnouncement as deleteAnnouncementInFirestore, 
  getParticipantsCountForSlot, 
  isMeetingOwner,
  markNotificationAsRead,
  markAllNotificationsAsRead
} from './services/firestoreService'

// 로딩 컴포넌트
const LoadingSpinner = () => (
  <div className="flex items-center justify-center h-64">
    <div className="text-center">
      <div className="w-12 h-12 mx-auto relative mb-4">
        {/* 외부 링 */}
        <motion.div
          className="w-full h-full border-4 border-blue-200 dark:border-blue-800 border-t-blue-500 dark:border-t-blue-400 rounded-full"
          animate={{ rotate: 360 }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: "linear",
          }}
        />
        {/* 내부 링 */}
        <motion.div
          className="absolute inset-2 border-2 border-purple-200 dark:border-purple-800 border-t-purple-500 dark:border-t-purple-400 rounded-full"
          animate={{ rotate: -360 }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      </div>
      <p className="text-gray-600 dark:text-gray-300 text-sm">로딩 중...</p>
    </div>
  </div>
)

function AppContent() {
  const { user, loading } = useAuth()
  const toast = useToast()
  const [view, setView] = useState('calendar') // 'calendar', 'schedule', 'campus', 'meetings', 'profile', 'settings'
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [events, setEvents] = useState([])
  const [meetings, setMeetings] = useState([])
  const [isEventModalOpen, setIsEventModalOpen] = useState(false)
  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false)
  const [showLoginPage, setShowLoginPage] = useState(false)
  const [editingEvent, setEditingEvent] = useState(null)
  const [editingMeeting, setEditingMeeting] = useState(null)
  const [selectedMeeting, setSelectedMeeting] = useState(null)
  const [showMeetingDetails, setShowMeetingDetails] = useState(false)
  const [showFirebaseSetupAlert, setShowFirebaseSetupAlert] = useState(false)
  const [notifications, setNotifications] = useState([])

  // 실시간 업데이트 감지
  useRealtimeUpdates(events, 'events')
  useRealtimeUpdates(meetings, 'meetings')
  useRealtimeUpdates(notifications, 'notifications')

  // 사용자 로그인 상태에 따른 로그인 페이지 관리
  useEffect(() => {
    if (user && showLoginPage) {
      setShowLoginPage(false)
    }
  }, [user, showLoginPage])

  // Firestore 실시간 구독 설정
  useEffect(() => {
    // Firebase 연결 상태 확인
    const isFirebaseConfigured = checkFirebaseConnection()
    
    if (!isFirebaseConfigured) {
      setShowFirebaseSetupAlert(true)
    }
    
    // 모든 모임 구독 (로그인 여부와 관계없이)
    const unsubscribeMeetings = subscribeToMeetings((meetingsData) => {
      if (import.meta.env.DEV) {
        console.log('App.jsx - 모임 데이터 업데이트:', meetingsData.length, '개')
      }
      setMeetings(meetingsData)
      
      // 현재 선택된 모임이 있다면 최신 데이터로 업데이트
      if (selectedMeeting) {
        const updatedMeeting = meetingsData.find(m => m.id === selectedMeeting.id)
        if (updatedMeeting) {
          setSelectedMeeting(updatedMeeting)
        }
      }
    })

    // 사용자 이벤트 구독 (로그인한 사용자만)
    let unsubscribeEvents = null
    let unsubscribeNotifications = null
    if (user) {
      unsubscribeEvents = subscribeToUserEvents(user.uid, (eventsData) => {
        if (import.meta.env.DEV) {
          console.log('App.jsx - 이벤트 데이터 업데이트:', eventsData.length, '개 이벤트')
        }
        setEvents(eventsData)
      })
      
      // 사용자 알림 구독
      unsubscribeNotifications = subscribeToUserNotifications(user.uid, (notificationsData) => {
        setNotifications(notificationsData)
      })
    } else {
      setEvents([])
      setNotifications([])
    }

    // 정리 함수
    return () => {
      if (unsubscribeEvents) {
        unsubscribeEvents()
      }
      if (unsubscribeNotifications) {
        unsubscribeNotifications()
      }
      unsubscribeMeetings()
    }
  }, [user])

  const addEvent = async (event) => {
    try {
      if (import.meta.env.DEV) {
        console.log('일정 추가 시도:', event)
      }
      
      // 사용자 인증 확인
      if (!user || !user.uid) {
        throw new Error('로그인이 필요합니다.')
      }
      
      // 이벤트 데이터 검증
      if (!event.title || !event.date) {
        throw new Error('제목과 날짜는 필수입니다.')
      }
      
      // Firebase 설정 확인
      const isFirebaseConfigured = checkFirebaseConnection()
      if (!isFirebaseConfigured) {
        // Firebase가 설정되지 않은 경우 로컬 상태에만 저장
        if (import.meta.env.DEV) {
          console.warn('Firebase 미설정 - 로컬 상태에 저장')
        }
        const newEvent = {
          ...event,
          id: Date.now().toString(), // 임시 ID
          userId: user.uid,
          createdAt: new Date()
        }
        setEvents(prev => [...prev, newEvent])
        closeEventModal()
        toast.showWarning('일정이 임시로 저장되었습니다. Firebase 설정 후 새로고침하면 데이터가 사라질 수 있습니다.', '임시 저장')
        return
      }
      
      // Firestore에 이벤트 생성
      const eventId = await createEventInFirestore(event, user.uid)
      if (import.meta.env.DEV) {
        console.log('일정 생성 성공, ID:', eventId)
      }
      
      // 성공 메시지
      toast.showSuccess('일정이 성공적으로 추가되었습니다!')
      closeEventModal()
      
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('이벤트 생성 실패:', error)
      }
      
      // 사용자 친화적인 에러 메시지
      let errorMessage = '일정 생성에 실패했습니다.'
      
      if (error.message.includes('permission')) {
        errorMessage = '권한이 없습니다. 다시 로그인해주세요.'
      } else if (error.message.includes('network')) {
        errorMessage = '네트워크 연결을 확인해주세요.'
      } else if (error.message.includes('Firestore') || error.message.includes('Firebase')) {
        // Firebase 오류인 경우 로컬 상태에 저장
        if (import.meta.env.DEV) {
          console.warn('Firebase 오류 - 로컬 상태에 저장')
        }
        const newEvent = {
          ...event,
          id: Date.now().toString(),
          userId: user.uid,
          createdAt: new Date()
        }
        setEvents(prev => [...prev, newEvent])
        closeEventModal()
        toast.showWarning('일정이 임시로 저장되었습니다. Firebase 설정을 확인해주세요.')
        return
      } else if (error.message) {
        errorMessage = error.message
      }
      
      toast.showError(errorMessage)
    }
  }

  const updateEvent = async (updatedEvent) => {
    try {
      await updateEventInFirestore(updatedEvent.id, updatedEvent)
      toast.showSuccess('일정이 성공적으로 수정되었습니다!')
      closeEventModal()
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('이벤트 업데이트 실패:', error)
      }
      toast.showError('이벤트 업데이트에 실패했습니다.')
    }
  }

  const deleteEvent = async (eventId) => {
    try {
      await deleteEventInFirestore(eventId)
      toast.showSuccess('일정이 성공적으로 삭제되었습니다!')
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('이벤트 삭제 실패:', error)
      }
      toast.showError('이벤트 삭제에 실패했습니다.')
    }
  }

  const openEventModal = (event = null) => {
    setEditingEvent(event)
    setIsEventModalOpen(true)
  }

  const handleBuildingClick = (building) => {
    // 건물 정보와 함께 새 이벤트 모달 열기
    openEventModal({ 
      buildingId: building.id,
      location: building.name,
      date: selectedDate
    })
  }

  const closeEventModal = () => {
    setIsEventModalOpen(false)
    setEditingEvent(null)
  }

  // 모임 관련 함수들
  const addMeeting = async (meetingData) => {
    try {
      if (import.meta.env.DEV) {
        console.log('App.jsx - 모임 생성 시작:', { meetingData, userId: user.uid })
      }
      
      // 사용자 인증 확인
      if (!user || !user.uid) {
        throw new Error('로그인이 필요합니다.')
      }
      
      // 모임 데이터 검증
      if (!meetingData.title || !meetingData.description) {
        throw new Error('모임 제목과 설명을 입력해주세요.')
      }
      
      const meetingId = await createMeetingInFirestore(meetingData, user.uid)
      if (import.meta.env.DEV) {
        console.log('App.jsx - 모임 생성 완료, ID:', meetingId)
      }
      
      // 성공 메시지
      toast.showSuccess('모임이 성공적으로 생성되었습니다!')
      closeMeetingModal()
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('App.jsx - 모임 생성 실패:', error)
      }
      
      // 사용자 친화적인 에러 메시지
      let errorMessage = '모임 생성에 실패했습니다.'
      if (error.message.includes('permission')) {
        errorMessage = '권한이 없습니다. 다시 로그인해주세요.'
      } else if (error.message.includes('network')) {
        errorMessage = '네트워크 연결을 확인해주세요.'
      } else if (error.message) {
        errorMessage = error.message
      }
      
      toast.showError(errorMessage)
    }
  }

  const updateMeeting = async (updatedMeeting) => {
    try {
      await updateMeetingInFirestore(updatedMeeting.id, updatedMeeting)
      toast.showSuccess('모임이 성공적으로 수정되었습니다!')
      closeMeetingModal()
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('모임 업데이트 실패:', error)
      }
      toast.showError('모임 업데이트에 실패했습니다.')
    }
  }

  const deleteMeeting = async (meetingId) => {
    try {
      // Firebase 설정 확인
      const isFirebaseConfigured = checkFirebaseConnection()
      if (!isFirebaseConfigured) {
        toast.showError('Firebase가 설정되지 않아 모임을 삭제할 수 없습니다.')
        return
      }
      
      await deleteMeetingInFirestore(meetingId)
      toast.showSuccess('모임이 성공적으로 삭제되었습니다.')
      
      // 모임 세부사항에서 돌아가기
      setShowMeetingDetails(false)
      setSelectedMeeting(null)
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('모임 삭제 실패:', error)
      }
      toast.showError('모임 삭제에 실패했습니다: ' + error.message)
    }
  }

  const openMeetingModal = (meeting = null) => {
    // 로그인하지 않은 사용자는 모임 생성 불가
    if (!meeting && (!user || !user.uid)) {
      toast.showWarning('모임을 생성하려면 로그인이 필요합니다.')
      return
    }
    
    setEditingMeeting(meeting)
    setIsMeetingModalOpen(true)
  }

  const closeMeetingModal = () => {
    setIsMeetingModalOpen(false)
    setEditingMeeting(null)
  }

  const joinMeeting = async (meeting) => {
    // 로그인하지 않은 사용자는 모임 참여 불가
    if (!user || !user.uid) {
      toast.showWarning('모임에 참여하려면 로그인이 필요합니다.')
      return
    }
    
    try {
      await joinMeetingInFirestore(meeting.id, user.uid)
      toast.showSuccess('모임에 성공적으로 참여했습니다!')
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('모임 참여 실패:', error)
      }
      toast.showError('모임 참여에 실패했습니다.')
    }
  }

  const handleAvailabilityChange = async (timeSlotIds) => {
    // 로그인하지 않은 사용자는 시간 조율 불가
    if (!user || !user.uid) {
      toast.showWarning('시간 조율을 하려면 로그인이 필요합니다.')
      return
    }
    
    // timeSlotIds가 배열인지 확인
    if (!Array.isArray(timeSlotIds)) {
      if (import.meta.env.DEV) {
        console.error('timeSlotIds는 배열이어야 합니다:', timeSlotIds)
      }
      return
    }
    
    if (selectedMeeting) {
      try {
        await updateAvailabilityInFirestore(selectedMeeting.id, user.uid, timeSlotIds)
        toast.showSuccess('가용성이 업데이트되었습니다!')
        // selectedMeeting 상태는 실시간 구독을 통해 자동으로 업데이트됨
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('가용성 업데이트 실패:', error)
        }
        toast.showError('가용성 업데이트에 실패했습니다.')
      }
    }
  }

  // 로딩 중일 때 표시할 컴포넌트
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center relative overflow-hidden">
        {/* 배경 파티클 효과 */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-blue-200 dark:bg-blue-800 rounded-full opacity-30"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                y: [0, -20, 0],
                opacity: [0.3, 0.8, 0.3],
              }}
              transition={{
                duration: 2 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 2,
              }}
            />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center relative z-10"
        >
          {/* Compendium 로고 */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="relative mb-8"
          >
            <div className="w-24 h-24 md:w-32 md:h-32 mx-auto relative">
              <img
                src="/Adobe Express - file.png"
                alt="Compendium"
                className="w-full h-full object-contain drop-shadow-lg"
              />
              {/* 로고 주변 글로우 효과 */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full opacity-20 blur-xl"
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.2, 0.4, 0.2],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                }}
              />
            </div>
          </motion.div>

          {/* 로딩 스피너 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="relative mb-6"
          >
            <div className="w-12 h-12 md:w-16 md:h-16 mx-auto relative">
              {/* 외부 링 */}
              <motion.div
                className="w-full h-full border-4 border-blue-200 dark:border-blue-800 border-t-blue-500 dark:border-t-blue-400 rounded-full"
                animate={{ rotate: 360 }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  ease: "linear",
                }}
              />
              {/* 내부 링 */}
              <motion.div
                className="absolute inset-2 border-2 border-purple-200 dark:border-purple-800 border-t-purple-500 dark:border-t-purple-400 rounded-full"
                animate={{ rotate: -360 }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "linear",
                }}
              />
            </div>
          </motion.div>

          {/* 로딩 텍스트 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="space-y-2"
          >
            <h2 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-white">
              Compendium<span className="text-green-500 text-sm md:text-lg align-super">β</span>
            </h2>
            <motion.p
              className="text-gray-600 dark:text-gray-300 text-sm md:text-base"
              animate={{
                opacity: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
              }}
            >
              로딩 중...
            </motion.p>
          </motion.div>

          {/* 진행률 표시 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="mt-6 w-48 mx-auto"
          >
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{
                  duration: 2,
                  ease: "easeInOut",
                }}
              />
            </div>
          </motion.div>
        </motion.div>
      </div>
    )
  }

  // 로그인하지 않은 사용자에게는 랜딩 페이지 표시
  if (!user) {
    return (
      <>
        {showLoginPage ? (
          <Suspense fallback={<LoadingSpinner />}>
            <LoginPage
              onBack={() => setShowLoginPage(false)}
            />
          </Suspense>
        ) : (
          <LandingPage 
            onGetStarted={() => setShowLoginPage(true)} 
          />
        )}
        
        {/* Firebase 설정 알림 */}
        <FirebaseSetupAlert
          isVisible={showFirebaseSetupAlert}
          onClose={() => setShowFirebaseSetupAlert(false)}
        />
      </>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:to-gray-800 flex flex-col">
          <Header
            view={view}
            setView={setView}
            onAddEvent={() => openEventModal()}
            onLogin={() => setShowLoginPage(true)}
            meetings={meetings}
            notifications={notifications}
            onNavigateToProfile={() => setView('profile')}
            onNavigateToSettings={() => setView('settings')}
            onMarkNotificationAsRead={markNotificationAsRead}
            onMarkAllNotificationsAsRead={() => markAllNotificationsAsRead(user?.uid)}
          />
      
      <main className="container mx-auto px-2 sm:px-4 py-3 sm:py-6 flex-1">
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="rounded-lg sm:rounded-xl p-3 sm:p-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm"
        >
          <Suspense fallback={<LoadingSpinner />}>
            {view === 'calendar' ? (
              <Dashboard
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
                events={events}
                meetings={meetings}
                onEventClick={openEventModal}
                onDateClick={(date) => {
                  setSelectedDate(date)
                  openEventModal({ date })
                }}
                onMeetingClick={(meeting) => {
                  if (import.meta.env.DEV) {
                    console.log('App.jsx - 모임 클릭:', meeting.id)
                  }
                  setSelectedMeeting(meeting)
                  setShowMeetingDetails(true)
                  setView('meetings') // meetings 뷰로 변경
                }}
                onViewChange={setView}
                currentUser={user}
              />
            ) : view === 'schedule' ? (
              <CalendarView
                events={events}
                onEventClick={openEventModal}
                onAddEvent={null}
                currentUser={user}
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
              />
            ) : view === 'meetings' ? (
              showMeetingDetails ? (
                <MeetingDetails
                  meeting={selectedMeeting}
                  currentUser={user}
                  onBack={() => setShowMeetingDetails(false)}
                  onDeleteMeeting={deleteMeeting}
                />
              ) : (
                <MeetingList
                  meetings={meetings}
                  currentUser={user}
                  onMeetingClick={(meeting) => {
                    setSelectedMeeting(meeting)
                    setShowMeetingDetails(true)
                  }}
                  onCreateMeeting={() => openMeetingModal()}
                  onJoinMeeting={joinMeeting}
                />
              )
            ) : view === 'profile' ? (
              <ProfilePage onBack={() => setView('calendar')} />
            ) : view === 'settings' ? (
              <SettingsPage onBack={() => setView('calendar')} />
            ) : null}
          </Suspense>
        </motion.div>
      </main>

      <Footer />

      {isEventModalOpen && (
        <Suspense fallback={<LoadingSpinner />}>
          <EventModal
            event={editingEvent}
            onSave={editingEvent ? updateEvent : addEvent}
            onDelete={editingEvent ? () => deleteEvent(editingEvent.id) : null}
            onClose={closeEventModal}
          />
        </Suspense>
      )}

      {isMeetingModalOpen && (
        <Suspense fallback={<LoadingSpinner />}>
          <MeetingModal
            meeting={editingMeeting}
            onSave={editingMeeting ? updateMeeting : addMeeting}
            onClose={closeMeetingModal}
            currentUser={user}
          />
        </Suspense>
      )}

      {showLoginPage && !user && (
        <Suspense fallback={<LoadingSpinner />}>
          <LoginPage
            onBack={() => setShowLoginPage(false)}
          />
        </Suspense>
      )}

      {/* Firebase 설정 알림 */}
        <FirebaseSetupAlert
          isVisible={showFirebaseSetupAlert}
          onClose={() => setShowFirebaseSetupAlert(false)}
        />
      </div>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </ErrorBoundary>
  )
}

export default App