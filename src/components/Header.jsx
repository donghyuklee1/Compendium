import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar as CalendarIcon, Grid, Plus, Bell, Sun, Moon, Users, Menu, X } from 'lucide-react'
import { useDarkMode } from '../hooks/useDarkMode'
import { useAuth } from '../contexts/AuthContext'
import UserProfile from './UserProfile'
import NotificationModal from './NotificationModal'

const Header = ({ view, setView, onAddEvent, onLogin, meetings = [], notifications = [], onNavigateToProfile, onNavigateToSettings, onMarkNotificationAsRead, onMarkAllNotificationsAsRead }) => {
  const [isDarkMode, toggleDarkMode] = useDarkMode()
  const { user } = useAuth()
  const [showNotificationModal, setShowNotificationModal] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)

  const handleMobileMenuClick = (newView) => {
    setView(newView)
    setShowMobileMenu(false)
  }

  return (
    <>
      <motion.header
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="sticky top-0 z-50 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-700"
      >
        <div className="container mx-auto px-2 py-2 sm:px-4 sm:py-3">
          <div className="flex items-center justify-between">
            {/* Logo and Title - 모바일에서 더 컴팩트하게 */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setView('calendar')}
              className="flex items-center space-x-2 md:space-x-3 cursor-pointer"
            >
              <div className="w-7 h-7 md:w-10 md:h-10 rounded-xl flex items-center justify-center">
                <img 
                  src="/Adobe Express - file.png" 
                  alt="Compendium Logo" 
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.target.style.display = 'none'
                    e.target.nextElementSibling.style.display = 'flex'
                  }}
                />
                <div className="w-full h-full bg-gradient-to-br from-kaist-blue to-kaist-lightblue rounded-xl flex items-center justify-center hidden">
                  <CalendarIcon className="w-3 h-3 md:w-6 md:h-6 text-white" />
                </div>
              </div>
              <div className="text-left">
                <h1 className="text-sm md:text-2xl font-bold text-kaist-blue leading-tight">
                  Compendium<span className="text-green-500 text-xs md:text-sm align-super">β</span>
                </h1>
                <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 leading-tight hidden md:block">간편한 일정 관리</p>
              </div>
            </motion.button>

            {/* Desktop Navigation - 기존 유지 */}
            <div className="hidden md:flex items-center space-x-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setView('calendar')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all duration-300 ${
                  view === 'calendar'
                    ? 'bg-kaist-blue text-white shadow-lg'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <CalendarIcon className="w-4 h-4" />
                <span className="font-medium">대시보드</span>
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setView('schedule')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all duration-300 ${
                  view === 'schedule'
                    ? 'bg-kaist-blue text-white shadow-lg'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span className="font-medium">📋</span>
                <span className="font-medium">스케줄</span>
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setView('meetings')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all duration-300 ${
                  view === 'meetings'
                    ? 'bg-kaist-blue text-white shadow-lg'
                    : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
              >
                <Users className="w-4 h-4" />
                <span className="font-medium">모임</span>
              </motion.button>
            </div>

            {/* Mobile Action Buttons - 더 컴팩트하게 */}
            <div className="flex items-center space-x-1 md:space-x-3">
              {/* 모바일에서만 햄버거 메뉴 표시 */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="md:hidden p-2 bg-white dark:bg-gray-700 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 text-gray-600 dark:text-gray-300"
              >
                {showMobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </motion.button>

              {/* 알림 버튼 - 데스크톱에서만 표시 */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowNotificationModal(true)}
                className="hidden md:block relative p-3 bg-white dark:bg-gray-700 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 text-gray-600 dark:text-gray-300 hover:text-kaist-blue dark:hover:text-blue-400"
              >
                <Bell className="w-5 h-5" />
                {/* 읽지 않은 알림 개수 표시 */}
                {(() => {
                  const unreadCount = notifications.filter(notification => !notification.isRead).length
                  
                  return unreadCount > 0 ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold"
                    >
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </motion.div>
                  ) : null
                })()}
              </motion.button>
              
              {/* 다크모드 토글 - 데스크톱에서만 표시 */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={toggleDarkMode}
                className="hidden md:block p-3 bg-white dark:bg-gray-700 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 text-gray-600 dark:text-gray-300 hover:text-kaist-blue dark:hover:text-blue-400"
              >
                {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </motion.button>
              
              {/* 일정 추가 버튼 - 모바일 최적화 */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onAddEvent}
                className="flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-lg md:rounded-xl font-medium transition-all duration-300 hover:shadow-lg active:scale-95 p-2 md:px-4 md:py-3 touch-action:manipulation"
              >
                <Plus className="w-5 h-5 md:w-5 md:h-5" />
                <span className="hidden md:inline ml-2">일정 추가</span>
              </motion.button>

              {/* 사용자 프로필 또는 로그인 버튼 */}
              {user ? (
                <UserProfile 
                  onNavigateToProfile={onNavigateToProfile}
                  onNavigateToSettings={onNavigateToSettings}
                />
              ) : (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onLogin}
                  className="btn-secondary flex items-center space-x-1 md:space-x-2 px-2 md:px-4 py-2"
                >
                  <Users className="w-4 h-4" />
                  <span className="hidden md:inline">로그인</span>
                </motion.button>
              )}
            </div>
          </div>
        </div>
      </motion.header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {showMobileMenu && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setShowMobileMenu(false)}
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute right-0 top-0 h-full w-80 bg-white dark:bg-gray-800 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">메뉴</h2>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowMobileMenu(false)}
                    className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                  >
                    <X className="w-5 h-5" />
                  </motion.button>
                </div>

                <div className="space-y-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleMobileMenuClick('calendar')}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                      view === 'calendar'
                        ? 'bg-kaist-blue text-white shadow-lg'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <CalendarIcon className="w-5 h-5" />
                    <span className="font-medium">대시보드</span>
                  </motion.button>
                  
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleMobileMenuClick('schedule')}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                      view === 'schedule'
                        ? 'bg-kaist-blue text-white shadow-lg'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <span className="text-lg">📋</span>
                    <span className="font-medium">스케줄</span>
                  </motion.button>
                  
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleMobileMenuClick('meetings')}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                      view === 'meetings'
                        ? 'bg-kaist-blue text-white shadow-lg'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <Users className="w-5 h-5" />
                    <span className="font-medium">모임</span>
                  </motion.button>
                </div>

                {/* 모바일 메뉴 하단 액션 버튼들 */}
                <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-600 space-y-3">
                  {/* 알림 버튼 */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setShowNotificationModal(true)
                      setShowMobileMenu(false)
                    }}
                    className="w-full flex items-center space-x-3 px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    <Bell className="w-5 h-5" />
                    <span className="font-medium">알림</span>
                    {(() => {
                      const unreadCount = notifications.filter(notification => !notification.isRead).length
                      
                      return unreadCount > 0 ? (
                        <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full ml-auto">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      ) : null
                    })()}
                  </motion.button>

                  {/* 다크모드 토글 */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      toggleDarkMode()
                      setShowMobileMenu(false)
                    }}
                    className="w-full flex items-center space-x-3 px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    <span className="font-medium">{isDarkMode ? '라이트 모드' : '다크 모드'}</span>
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      onAddEvent()
                      setShowMobileMenu(false)
                    }}
                    className="w-full flex items-center space-x-3 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                    <span className="font-medium">일정 추가</span>
                  </motion.button>

                  {!user && (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        onLogin()
                        setShowMobileMenu(false)
                      }}
                      className="w-full flex items-center space-x-3 px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      <Users className="w-5 h-5" />
                      <span className="font-medium">로그인</span>
                    </motion.button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 알림 모달 */}
      <NotificationModal 
        isOpen={showNotificationModal} 
        onClose={() => setShowNotificationModal(false)}
        meetings={meetings}
        notifications={notifications}
        onMarkNotificationAsRead={onMarkNotificationAsRead}
        onMarkAllNotificationsAsRead={onMarkAllNotificationsAsRead}
      />
    </>
  )
}

export default Header
