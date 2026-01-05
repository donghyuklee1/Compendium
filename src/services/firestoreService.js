import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDoc,
  getDocs,
  onSnapshot, 
  query, 
  orderBy, 
  where,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  writeBatch
} from 'firebase/firestore'
import { db } from '../config/firebase'

// 컬렉션 이름 상수
export const COLLECTIONS = {
  EVENTS: 'events',
  MEETINGS: 'meetings',
  NOTIFICATIONS: 'notifications'
}

// ==================== 이벤트 관련 함수 ====================

// 사용자별 이벤트 구독
export const subscribeToUserEvents = (userId, callback) => {
  try {
    if (!userId) {
      if (import.meta.env.DEV) {
        console.log('사용자 ID가 없어서 이벤트 구독을 중단합니다.')
      }
      callback([])
      return () => {}
    }

    // Firebase 설정 확인
    if (!db) {
      if (import.meta.env.DEV) {
        console.error('❌ Firestore 데이터베이스가 초기화되지 않았습니다.')
      }
      callback([])
      return () => {}
    }

    if (import.meta.env.DEV) {
      console.log('사용자 이벤트 구독 시작:', userId)
    }

    const q = query(
      collection(db, COLLECTIONS.EVENTS),
      where('userId', '==', userId),
      orderBy('date', 'asc')
    )

    return onSnapshot(q, (snapshot) => {
      if (import.meta.env.DEV) {
        console.log('사용자 이벤트 데이터 변경 감지:', snapshot.docs.length, '개 이벤트')
      }
      
      // 변경사항이 있는 경우에만 처리
      if (snapshot.docChanges().length > 0 && import.meta.env.DEV) {
        console.log('이벤트 변경사항:', snapshot.docChanges().map(change => ({
          type: change.type,
          docId: change.doc.id,
          title: change.doc.data().title
        })))
      }
      
      const events = snapshot.docs.map(doc => {
        const data = doc.data()
        
        // 날짜 객체 정규화 (여러 형식 지원)
        let eventDate
        if (data.date?.toDate) {
          // Firestore Timestamp
          eventDate = data.date.toDate()
        } else if (data.date instanceof Date) {
          // 이미 Date 객체
          eventDate = data.date
        } else if (typeof data.date === 'string') {
          // ISO 문자열 또는 yyyy-MM-dd 형식
          eventDate = new Date(data.date)
          // 유효하지 않은 날짜인 경우 처리
          if (isNaN(eventDate.getTime())) {
            // yyyy-MM-dd 형식인 경우
            const [year, month, day] = data.date.split('-')
            if (year && month && day) {
              eventDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
            }
          }
        } else {
          // 기본값 (오늘)
          eventDate = new Date()
        }
        
        const processedEvent = {
          id: doc.id,
          ...data,
          date: eventDate,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date()),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt ? new Date(data.updatedAt) : new Date())
        }
        
        if (import.meta.env.DEV) {
          console.log('처리된 이벤트:', {
            id: processedEvent.id,
            title: processedEvent.title,
            date: processedEvent.date,
            dateType: typeof processedEvent.date,
            isRecurring: processedEvent.isRecurring
          })
        }
        
        return processedEvent
      })
      
      // 날짜순 정렬 (클라이언트 사이드에서도 정렬)
      events.sort((a, b) => new Date(a.date) - new Date(b.date))
      
      callback(events)
    }, (error) => {
      console.error('사용자 이벤트 구독 오류:', error)
      console.error('에러 상세:', {
        code: error.code,
        message: error.message,
        stack: error.stack
      })
      
      // Firebase 설정 문제인지 확인
      if (error.code === 'permission-denied') {
        console.error('❌ Firestore 보안 규칙 문제입니다. Firebase Console에서 보안 규칙을 설정해주세요.')
      } else if (error.code === 'unavailable') {
        console.error('❌ Firebase 서비스에 연결할 수 없습니다. 네트워크 연결을 확인해주세요.')
      } else if (error.message.includes('400')) {
        console.error('❌ Firebase 설정이 잘못되었습니다. 환경 변수를 확인해주세요.')
      }
      
      callback([])
    })
  } catch (error) {
    console.error('사용자 이벤트 구독 초기화 오류:', error)
    callback([])
    return () => {}
  }
}

// 이벤트 생성
export const createEvent = async (eventData, userId) => {
  try {
    if (import.meta.env.DEV) {
      console.log('이벤트 생성 시작:', { eventData, userId })
    }
    
    // Firebase 설정 확인
    if (!db) {
      throw new Error('Firestore 데이터베이스가 초기화되지 않았습니다.')
    }
    
    // 필수 필드 검증
    if (!userId) {
      throw new Error('사용자 ID가 필요합니다.')
    }
    
    if (!eventData.title || !eventData.date) {
      throw new Error('제목과 날짜는 필수입니다.')
    }
    
    // 날짜 객체 변환
    let eventDate = eventData.date
    if (typeof eventDate === 'string') {
      eventDate = new Date(eventDate)
    }
    
    // 유효한 날짜인지 확인
    if (isNaN(eventDate.getTime())) {
      throw new Error('올바른 날짜 형식이 아닙니다.')
    }
    
    // 날짜를 Date 객체로 정규화 (시간은 00:00:00으로 설정)
    const normalizedDate = new Date(eventDate)
    normalizedDate.setHours(0, 0, 0, 0)
    
    const eventDoc = {
      title: eventData.title,
      description: eventData.description || '',
      date: normalizedDate, // Date 객체로 저장 (Firestore가 Timestamp로 변환)
      time: eventData.time || '',
      endTime: eventData.endTime || '',
      duration: eventData.duration || null,
      location: eventData.location || '',
      buildingId: eventData.buildingId || '',
      category: eventData.category || 'personal',
      priority: eventData.priority || 'medium',
      userId,
      isRecurring: eventData.isRecurring || false,
      recurrenceType: eventData.recurrenceType || 'none',
      recurrenceEndDate: eventData.recurrenceEndDate || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }
    
    if (import.meta.env.DEV) {
      console.log('저장할 이벤트 데이터:', {
        ...eventDoc,
        date: normalizedDate,
        dateType: typeof normalizedDate
      })
    }
    
    const docRef = await addDoc(collection(db, COLLECTIONS.EVENTS), eventDoc)
    
    if (import.meta.env.DEV) {
      console.log('이벤트 생성 성공, ID:', docRef.id)
      
      // 생성 후 즉시 문서를 다시 읽어서 확인
      const createdDoc = await getDoc(docRef)
      if (createdDoc.exists()) {
        const createdData = createdDoc.data()
        console.log('생성된 문서 확인:', {
          id: createdDoc.id,
          title: createdData.title,
          date: createdData.date,
          dateType: typeof createdData.date
        })
      }
    }
    
    return docRef.id
  } catch (error) {
    console.error('이벤트 생성 실패:', error)
    console.error('에러 상세:', {
      code: error.code,
      message: error.message,
      stack: error.stack
    })
    
    // Firestore 특정 오류 처리
    if (error.code === 'permission-denied') {
      throw new Error('권한이 없습니다. 다시 로그인해주세요.')
    } else if (error.code === 'unavailable') {
      throw new Error('네트워크 연결을 확인해주세요.')
    } else if (error.code === 'invalid-argument') {
      throw new Error('입력 데이터가 올바르지 않습니다.')
    }
    
    throw error
  }
}

// 이벤트 업데이트
export const updateEvent = async (eventId, eventData) => {
  try {
    if (!db) {
      throw new Error('Firestore 데이터베이스가 초기화되지 않았습니다.')
    }
    
    const eventRef = doc(db, COLLECTIONS.EVENTS, eventId)
    
    // 날짜 객체 정규화
    const updateData = { ...eventData }
    if (updateData.date) {
      let eventDate = updateData.date
      if (typeof eventDate === 'string') {
        eventDate = new Date(eventDate)
      }
      if (eventDate instanceof Date) {
        eventDate.setHours(0, 0, 0, 0)
        updateData.date = eventDate
      }
    }
    
    await updateDoc(eventRef, {
      ...updateData,
      updatedAt: serverTimestamp()
    })
    
    if (import.meta.env.DEV) {
      console.log('이벤트 업데이트 성공:', eventId)
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('이벤트 업데이트 실패:', error)
    }
    throw error
  }
}

// 이벤트 삭제
export const deleteEvent = async (eventId) => {
  try {
    await deleteDoc(doc(db, COLLECTIONS.EVENTS, eventId))
  } catch (error) {
    console.error('이벤트 삭제 실패:', error)
    throw error
  }
}

// ==================== 모임 관련 함수 ====================

// 모든 모임 구독 (공개 모임)
export const subscribeToMeetings = (callback) => {
  try {
    // Firebase 설정 확인
    if (!db) {
      console.error('❌ Firestore 데이터베이스가 초기화되지 않았습니다.')
      callback([])
      return () => {}
    }

    // orderBy 없이 먼저 시도하고, 실패하면 클라이언트에서 정렬
    const q = query(collection(db, COLLECTIONS.MEETINGS))

    return onSnapshot(q, (snapshot) => {
      console.log('모임 데이터 변경 감지:', snapshot.docs.length, '개 모임')
      
      // 변경사항이 있는 경우에만 처리
      if (snapshot.docChanges().length > 0) {
        console.log('모임 변경사항:', snapshot.docChanges().map(change => ({
          type: change.type,
          docId: change.doc.id,
          title: change.doc.data().title
        })))
      }
      
      const meetings = snapshot.docs.map(doc => {
        const data = doc.data()
        return {
          id: doc.id,
          ...data,
          // 날짜 객체 정규화
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || 0),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt || 0),
          // 참여자 데이터 정규화
          participants: data.participants?.map(p => ({
            ...p,
            joinedAt: p.joinedAt ? new Date(p.joinedAt) : new Date()
          })) || []
        }
      })
      
      // 클라이언트에서 생성일 기준으로 정렬 (최신순)
      meetings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      
      callback(meetings)
    }, (error) => {
      console.error('모임 구독 오류:', error)
      console.error('에러 상세:', {
        code: error.code,
        message: error.message,
        stack: error.stack
      })
      
      // Firebase 설정 문제인지 확인
      if (error.code === 'permission-denied') {
        console.error('❌ Firestore 보안 규칙 문제입니다. Firebase Console에서 보안 규칙을 설정해주세요.')
      } else if (error.code === 'unavailable') {
        console.error('❌ Firebase 서비스에 연결할 수 없습니다. 네트워크 연결을 확인해주세요.')
      } else if (error.message.includes('400')) {
        console.error('❌ Firebase 설정이 잘못되었습니다. 환경 변수를 확인해주세요.')
      }
      
      // 오류 발생 시 빈 배열 반환
      callback([])
    })
  } catch (error) {
    console.error('Firestore 구독 초기화 오류:', error)
    callback([])
    return () => {}
  }
}

// 모임 생성
export const createMeeting = async (meetingData, userId) => {
  try {
    console.log('모임 생성 시작:', { meetingData, userId })
    
    // 필수 필드 검증
    if (!userId) {
      throw new Error('사용자 ID가 필요합니다.')
    }
    
    if (!meetingData.title || !meetingData.description) {
      throw new Error('모임 제목과 설명은 필수입니다.')
    }
    
    const meetingDoc = {
      ...meetingData,
      owner: userId,
      ownerName: meetingData.organizer || '미정', // 개설자 이름 설정
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      participants: [{
        userId,
        status: 'owner',
        joinedAt: new Date().toISOString(),
        displayName: meetingData.organizer || '미정'
      }],
      availability: {},
      announcements: [],
      status: meetingData.status || 'open' // 기본 상태 추가
    }
    
    console.log('저장할 모임 데이터:', meetingDoc)
    
    // Firestore에 문서 추가
    const docRef = await addDoc(collection(db, COLLECTIONS.MEETINGS), meetingDoc)
    console.log('모임 생성 성공, ID:', docRef.id)
    
    // 생성된 문서 ID 반환
    return docRef.id
  } catch (error) {
    console.error('모임 생성 실패:', error)
    console.error('에러 상세:', {
      code: error.code,
      message: error.message,
      stack: error.stack
    })
    throw error
  }
}

// 모임 업데이트
export const updateMeeting = async (meetingId, meetingData) => {
  try {
    const meetingRef = doc(db, COLLECTIONS.MEETINGS, meetingId)
    await updateDoc(meetingRef, {
      ...meetingData,
      updatedAt: serverTimestamp()
    })
  } catch (error) {
    console.error('모임 업데이트 실패:', error)
    throw error
  }
}

// 모임 삭제
export const deleteMeeting = async (meetingId) => {
  try {
    await deleteDoc(doc(db, COLLECTIONS.MEETINGS, meetingId))
  } catch (error) {
    console.error('모임 삭제 실패:', error)
    throw error
  }
}

// 모임 참여
export const joinMeeting = async (meetingId, userId) => {
  try {
    const meetingRef = doc(db, COLLECTIONS.MEETINGS, meetingId)
    await updateDoc(meetingRef, {
      participants: arrayUnion({
        userId,
        status: 'pending',
        joinedAt: new Date().toISOString()
      }),
      updatedAt: serverTimestamp()
    })
  } catch (error) {
    console.error('모임 참여 실패:', error)
    throw error
  }
}

// 모임 참여자 상태 업데이트
export const updateParticipantStatus = async (meetingId, userId, newStatus) => {
  try {
    const meetingRef = doc(db, COLLECTIONS.MEETINGS, meetingId)
    
    // 먼저 현재 모임 데이터를 가져와서 참여자 상태를 업데이트
    // 이는 Firestore의 제한으로 인해 array 내부 요소를 직접 업데이트할 수 없기 때문
    const meetingDoc = await getDoc(meetingRef)
    if (!meetingDoc.exists()) {
      throw new Error('모임을 찾을 수 없습니다')
    }
    
    const meetingData = meetingDoc.data()
    const updatedParticipants = meetingData.participants.map(p => 
      p.userId === userId ? { ...p, status: newStatus } : p
    )
    
        await updateDoc(meetingRef, {
          participants: updatedParticipants,
          updatedAt: serverTimestamp()
        })
  } catch (error) {
    console.error('참여자 상태 업데이트 실패:', error)
    throw error
  }
}

// 가용성 업데이트
export const updateAvailability = async (meetingId, userId, timeSlotIds) => {
  try {
    // timeSlotIds가 배열인지 확인
    if (!Array.isArray(timeSlotIds)) {
      throw new Error('timeSlotIds는 배열이어야 합니다')
    }
    
    const meetingRef = doc(db, COLLECTIONS.MEETINGS, meetingId)
    await updateDoc(meetingRef, {
      [`availability.${userId}`]: timeSlotIds,
      updatedAt: serverTimestamp()
    })
  } catch (error) {
    console.error('가용성 업데이트 실패:', error)
    throw error
  }
}

// 공지사항 추가
export const addAnnouncement = async (meetingId, announcementData, userId) => {
  try {
    console.log('공지사항 추가 시작:', { meetingId, announcementData, userId })
    
    if (!db) {
      throw new Error('Firestore 데이터베이스가 초기화되지 않았습니다.')
    }
    
    const meetingRef = doc(db, COLLECTIONS.MEETINGS, meetingId)
    
    // 현재 모임 데이터를 가져와서 공지사항을 추가
    const meetingDoc = await getDoc(meetingRef)
    if (!meetingDoc.exists()) {
      throw new Error('모임을 찾을 수 없습니다')
    }
    
    const meetingData = meetingDoc.data()
    
    // 소유자 권한 확인
    if (meetingData.owner !== userId) {
      throw new Error('모임 소유자만 공지사항을 추가할 수 있습니다')
    }
    
    const newAnnouncement = {
      id: Date.now().toString(),
      ...announcementData,
      authorId: userId,
      createdAt: new Date().toISOString(),
      priority: announcementData.priority || 'normal'
    }
    
    const updatedAnnouncements = [...(meetingData.announcements || []), newAnnouncement]
    
    await updateDoc(meetingRef, {
      announcements: updatedAnnouncements,
      updatedAt: serverTimestamp()
    })
    
    // 중요 공지사항인 경우 모임원들에게 알림 생성
    if (newAnnouncement.priority === 'high' || newAnnouncement.priority === 'urgent') {
      await createAnnouncementNotifications(meetingId, newAnnouncement, meetingData.participants)
    }
    
    console.log('공지사항 추가 성공:', newAnnouncement)
  } catch (error) {
    console.error('공지사항 추가 실패:', error)
    throw error
  }
}

// 공지사항 삭제
export const deleteAnnouncement = async (meetingId, announcementId, userId) => {
  try {
    const meetingRef = doc(db, COLLECTIONS.MEETINGS, meetingId)
    
    // 현재 모임 데이터를 가져와서 공지사항을 제거
    const meetingDoc = await getDoc(meetingRef)
    if (!meetingDoc.exists()) {
      throw new Error('모임을 찾을 수 없습니다')
    }
    
    const meetingData = meetingDoc.data()
    const updatedAnnouncements = meetingData.announcements.filter(
      announcement => announcement.id !== announcementId
    )
    
        await updateDoc(meetingRef, {
          announcements: updatedAnnouncements,
          updatedAt: serverTimestamp()
        })
  } catch (error) {
    console.error('공지사항 삭제 실패:', error)
    throw error
  }
}

// ==================== 유틸리티 함수 ====================

// 특정 시간 슬롯에 가능한 참여자 수 계산
export const getParticipantsCountForSlot = (meeting, fullSlotId) => {
  let count = 0
  for (const userId in meeting.availability) {
    if (meeting.availability[userId].includes(fullSlotId)) {
      // 해당 유저가 모임의 승인된 참여자인지 확인
      const participant = meeting.participants.find(p => p.userId === userId)
      if (participant && (participant.status === 'approved' || participant.status === 'owner')) {
        count++
      }
    }
  }
  return count
}

// 모임 삭제
export const deleteMeetingInFirestore = async (meetingId) => {
  try {
    console.log('모임 삭제 시작:', meetingId)
    
    if (!db) {
      throw new Error('Firestore 데이터베이스가 초기화되지 않았습니다.')
    }
    
    const meetingRef = doc(db, COLLECTIONS.MEETINGS, meetingId)
    await deleteDoc(meetingRef)
    
    console.log('모임 삭제 성공:', meetingId)
  } catch (error) {
    console.error('모임 삭제 실패:', error)
    throw error
  }
}


// 참가 신청 보내기
export const sendJoinRequest = async (meetingId, userId, userInfo) => {
  try {
    console.log('참가 신청 보내기:', { meetingId, userId, userInfo })
    
    if (!db) {
      throw new Error('Firestore 데이터베이스가 초기화되지 않았습니다.')
    }
    
    const meetingRef = doc(db, COLLECTIONS.MEETINGS, meetingId)
    
    // 현재 모임 데이터를 가져와서 중복 확인
    const meetingDoc = await getDoc(meetingRef)
    if (!meetingDoc.exists()) {
      throw new Error('모임을 찾을 수 없습니다')
    }
    
    const meetingData = meetingDoc.data()
    
    // 이미 참가자이거나 신청한 경우 확인
    const existingParticipant = meetingData.participants.find(p => p.userId === userId)
    if (existingParticipant) {
      if (existingParticipant.status === 'owner' || existingParticipant.status === 'approved') {
        throw new Error('이미 모임에 참가하고 있습니다.')
      } else if (existingParticipant.status === 'pending') {
        throw new Error('이미 참가 신청을 보냈습니다.')
      }
    }
    
    // 참가 신청 추가
    const newRequest = {
      userId,
      status: 'pending',
      joinedAt: new Date().toISOString(),
      displayName: userInfo.displayName || '익명',
      email: userInfo.email || '',
      photoURL: userInfo.photoURL || ''
    }
    
    const updatedParticipants = [...meetingData.participants, newRequest]
    
    await updateDoc(meetingRef, {
      participants: updatedParticipants,
      updatedAt: serverTimestamp()
    })
    
    console.log('참가 신청 성공:', newRequest)
  } catch (error) {
    console.error('참가 신청 실패:', error)
    throw error
  }
}

// 참가 신청 승인/거부
export const handleJoinRequest = async (meetingId, userId, action) => {
  try {
    console.log('참가 신청 처리:', { meetingId, userId, action })
    
    if (!db) {
      throw new Error('Firestore 데이터베이스가 초기화되지 않았습니다.')
    }
    
    const meetingRef = doc(db, COLLECTIONS.MEETINGS, meetingId)
    
    // 현재 모임 데이터를 가져와서 참가자 상태 업데이트
    const meetingDoc = await getDoc(meetingRef)
    if (!meetingDoc.exists()) {
      throw new Error('모임을 찾을 수 없습니다')
    }
    
    const meetingData = meetingDoc.data()
    const updatedParticipants = meetingData.participants.map(p => {
      if (p.userId === userId && p.status === 'pending') {
        return {
          ...p,
          status: action === 'approve' ? 'approved' : 'rejected',
          processedAt: new Date().toISOString()
        }
      }
      return p
    })
    
    await updateDoc(meetingRef, {
      participants: updatedParticipants,
      updatedAt: serverTimestamp()
    })
    
    console.log('참가 신청 처리 성공:', { userId, action })
  } catch (error) {
    console.error('참가 신청 처리 실패:', error)
    throw error
  }
}

// 참가 신청 취소
export const cancelJoinRequest = async (meetingId, userId) => {
  try {
    console.log('참가 신청 취소:', { meetingId, userId })
    
    if (!db) {
      throw new Error('Firestore 데이터베이스가 초기화되지 않았습니다.')
    }
    
    const meetingRef = doc(db, COLLECTIONS.MEETINGS, meetingId)
    
    // 현재 모임 데이터를 가져와서 참가자 제거
    const meetingDoc = await getDoc(meetingRef)
    if (!meetingDoc.exists()) {
      throw new Error('모임을 찾을 수 없습니다')
    }
    
    const meetingData = meetingDoc.data()
    const updatedParticipants = meetingData.participants.filter(p => !(p.userId === userId && p.status === 'pending'))
    
    await updateDoc(meetingRef, {
      participants: updatedParticipants,
      updatedAt: serverTimestamp()
    })
    
    console.log('참가 신청 취소 성공:', userId)
  } catch (error) {
    console.error('참가 신청 취소 실패:', error)
    throw error
  }
}

// 모임 모집 상태 업데이트
export const updateMeetingStatus = async (meetingId, status, userId) => {
  try {
    console.log('모임 상태 업데이트:', { meetingId, status, userId })
    
    if (!db) {
      throw new Error('Firestore 데이터베이스가 초기화되지 않았습니다.')
    }
    
    const meetingRef = doc(db, COLLECTIONS.MEETINGS, meetingId)
    
    // 현재 모임 데이터를 가져와서 소유자인지 확인
    const meetingDoc = await getDoc(meetingRef)
    if (!meetingDoc.exists()) {
      throw new Error('모임을 찾을 수 없습니다')
    }
    
    const meetingData = meetingDoc.data()
    if (meetingData.owner !== userId) {
      throw new Error('모임 소유자만 상태를 변경할 수 있습니다')
    }
    
    // 유효한 상태인지 확인
    const validStatuses = ['open', 'closed', 'full']
    if (!validStatuses.includes(status)) {
      throw new Error('유효하지 않은 상태입니다')
    }
    
    await updateDoc(meetingRef, {
      status: status,
      updatedAt: serverTimestamp()
    })
    
    console.log('모임 상태 업데이트 성공:', { meetingId, status })
  } catch (error) {
    console.error('모임 상태 업데이트 실패:', error)
    throw error
  }
}

// 출석 관리 관련 함수들

// 6자리 랜덤 숫자 생성
export const generateAttendanceCode = () => {
  let result = ''
  for (let i = 0; i < 6; i++) {
    result += Math.floor(Math.random() * 10)
  }
  return result
}

// 출석 확인 시간 설정 (기본 3분, 최대 10분)
export const getAttendanceDuration = (duration = 3) => {
  const minutes = Math.min(Math.max(duration, 1), 10) // 1-10분 사이
  return minutes * 60 * 1000 // 밀리초로 변환
}

// 출석 확인 시작 (날짜별 관리, 개선된 버전)
export const startAttendanceCheck = async (meetingId, userId, attendanceDate = null, duration = 3) => {
  try {
    if (!db) {
      throw new Error('Firebase가 초기화되지 않았습니다')
    }

    const meetingRef = doc(db, COLLECTIONS.MEETINGS, meetingId)
    
    // 현재 모임 데이터를 가져와서 소유자인지 확인
    const meetingDoc = await getDoc(meetingRef)
    if (!meetingDoc.exists()) {
      throw new Error('모임을 찾을 수 없습니다')
    }
    
    const meetingData = meetingDoc.data()
    if (meetingData.owner !== userId) {
      throw new Error('모임 소유자만 출석 확인을 시작할 수 있습니다')
    }
    
    // 이미 활성화된 출석 확인이 있는지 확인
    if (meetingData.attendanceCheck?.isActive) {
      throw new Error('이미 출석 확인이 진행 중입니다')
    }
    
    // 출석 날짜 설정 (기본값: 오늘)
    const targetDate = attendanceDate || new Date().toISOString().split('T')[0]
    
    const attendanceCode = generateAttendanceCode()
    const endTime = new Date(Date.now() + getAttendanceDuration(duration))
    
    console.log('출석확인 시작 - 모임 ID:', meetingId)
    console.log('출석확인 시작 - 사용자 ID:', userId)
    console.log('출석확인 시작 - 코드:', attendanceCode)
    console.log('출석확인 시작 - 종료 시간:', endTime)
    
    // 날짜별 출석 기록 구조
    const attendanceRecord = {
      date: targetDate,
      code: attendanceCode,
      startTime: serverTimestamp(),
      endTime: endTime.toISOString(),
      attendees: [],
      isActive: true
    }
    
    // 기존 출석 기록 가져오기
    const existingAttendanceHistory = meetingData.attendanceHistory || {}
    
    // 해당 날짜의 출석 기록 업데이트
    existingAttendanceHistory[targetDate] = attendanceRecord
    
    console.log('Firestore 업데이트 시작 - 모임 ID:', meetingId)
    console.log('업데이트할 출석 기록:', existingAttendanceHistory)
    
    await updateDoc(meetingRef, {
      attendanceHistory: existingAttendanceHistory,
      // 현재 활성 출석 확인 (하위 호환성)
      attendanceCheck: {
        isActive: true,
        code: attendanceCode,
        startTime: serverTimestamp(),
        endTime: endTime.toISOString(),
        attendees: [],
        currentDate: targetDate
      },
      updatedAt: serverTimestamp()
    })
    
    console.log('Firestore 업데이트 완료 - 모임 ID:', meetingId)
    
    console.log('출석 확인 시작 성공, 날짜:', targetDate, '코드:', attendanceCode)
    return { code: attendanceCode, date: targetDate, endTime: endTime.toISOString() }
  } catch (error) {
    console.error('출석 확인 시작 실패:', error)
    throw error
  }
}

// 출석 확인 종료 (날짜별 관리)
export const endAttendanceCheck = async (meetingId, userId) => {
  try {
    if (!db) {
      throw new Error('Firebase가 초기화되지 않았습니다')
    }

    const meetingRef = doc(db, COLLECTIONS.MEETINGS, meetingId)
    
    // 현재 모임 데이터를 가져와서 소유자인지 확인
    const meetingDoc = await getDoc(meetingRef)
    if (!meetingDoc.exists()) {
      throw new Error('모임을 찾을 수 없습니다')
    }
    
    const meetingData = meetingDoc.data()
    if (meetingData.owner !== userId) {
      throw new Error('모임 소유자만 출석 확인을 종료할 수 있습니다')
    }
    
    const currentDate = meetingData.attendanceCheck?.currentDate || new Date().toISOString().split('T')[0]
    const attendanceHistory = meetingData.attendanceHistory || {}
    
    // 해당 날짜의 출석 기록 업데이트
    if (attendanceHistory[currentDate]) {
      attendanceHistory[currentDate] = {
        ...attendanceHistory[currentDate],
        isActive: false,
        endTime: serverTimestamp()
      }
    }
    
    await updateDoc(meetingRef, {
      attendanceHistory: attendanceHistory,
      // 현재 활성 출석 확인 비활성화 (하위 호환성)
      attendanceCheck: {
        isActive: false,
        code: null,
        startTime: null,
        endTime: serverTimestamp(),
        attendees: meetingData.attendanceCheck?.attendees || [],
        currentDate: null
      },
      updatedAt: serverTimestamp()
    })
    
    console.log('출석 확인 종료 성공, 날짜:', currentDate)
  } catch (error) {
    console.error('출석 확인 종료 실패:', error)
    throw error
  }
}

// 출석 코드 입력 (날짜별 관리, 개선된 버전)
export const submitAttendanceCode = async (meetingId, userId, code) => {
  try {
    if (!db) {
      throw new Error('Firebase가 초기화되지 않았습니다')
    }

    const meetingRef = doc(db, COLLECTIONS.MEETINGS, meetingId)
    
    // 현재 모임 데이터를 가져와서 출석 확인이 활성화되어 있는지 확인
    const meetingDoc = await getDoc(meetingRef)
    if (!meetingDoc.exists()) {
      throw new Error('모임을 찾을 수 없습니다')
    }
    
    const meetingData = meetingDoc.data()
    if (!meetingData.attendanceCheck?.isActive) {
      throw new Error('출석 확인이 진행 중이 아닙니다')
    }
    
    // 시간 만료 확인
    const endTime = new Date(meetingData.attendanceCheck.endTime)
    if (new Date() > endTime) {
      throw new Error('출석 확인 시간이 만료되었습니다')
    }
    
    // 코드 검증 (대소문자 구분 없이)
    if (meetingData.attendanceCheck.code.toUpperCase() !== code.toUpperCase()) {
      throw new Error('잘못된 출석 코드입니다')
    }
    
    const currentDate = meetingData.attendanceCheck?.currentDate || new Date().toISOString().split('T')[0]
    const attendanceHistory = meetingData.attendanceHistory || {}
    
    // 해당 날짜의 출석 기록에서 이미 출석한 사용자인지 확인
    const currentDateRecord = attendanceHistory[currentDate]
    const existingAttendee = currentDateRecord?.attendees?.find(
      attendee => attendee.userId === userId
    )
    
    if (existingAttendee) {
      throw new Error('이미 출석 확인을 완료했습니다')
    }
    
    // 출석자 목록에 추가
    const newAttendee = {
      userId: userId,
      timestamp: new Date().toISOString()
    }
    
    // 날짜별 출석 기록 업데이트
    if (attendanceHistory[currentDate]) {
      attendanceHistory[currentDate] = {
        ...attendanceHistory[currentDate],
        attendees: [...(attendanceHistory[currentDate].attendees || []), newAttendee]
      }
    }
    
    await updateDoc(meetingRef, {
      attendanceHistory: attendanceHistory,
      // 현재 활성 출석 확인에도 추가 (하위 호환성)
      'attendanceCheck.attendees': arrayUnion(newAttendee),
      updatedAt: serverTimestamp()
    })
    
    console.log('출석 확인 성공:', userId, '날짜:', currentDate)
    return true
  } catch (error) {
    console.error('출석 확인 실패:', error)
    throw error
  }
}

// 출석 현황 가져오기
export const getAttendanceStatus = (meeting) => {
  if (!meeting?.attendanceCheck) {
    return {
      isActive: false,
      attendees: [],
      totalParticipants: meeting?.participants?.filter(p => p.status === 'approved' || p.status === 'owner').length || 0,
      attendanceRate: 0
    }
  }
  
  const attendees = meeting.attendanceCheck.attendees || []
  // 승인된 참여자만 계산 (모임장 제외)
  const participantsExcludingOwner = meeting?.participants?.filter(p => p.status === 'approved') || []
  const totalParticipants = participantsExcludingOwner.length
  
  return {
    isActive: meeting.attendanceCheck.isActive,
    attendees: attendees,
    totalParticipants: totalParticipants,
    attendanceRate: totalParticipants > 0 ? Math.round((attendees.length / totalParticipants) * 100) : 0,
    code: meeting.attendanceCheck.code,
    endTime: meeting.attendanceCheck.endTime
  }
}

// 모임 소유자 확인
export const isMeetingOwner = (meeting, userId) => {
  if (!meeting || !userId) return false
  return meeting.owner === userId
}

// 모임 참여자 확인
export const isMeetingParticipant = (meeting, userId) => {
  if (!meeting || !userId) return false
  return meeting.participants?.some(p => p.userId === userId && p.status === 'approved')
}

// 대기 중인 참가 신청 확인
export const hasPendingRequest = (meeting, userId) => {
  if (!meeting || !userId) return false
  return meeting.participants?.some(p => p.userId === userId && p.status === 'pending')
}

// 모임원별 출석률 계산
export const getMemberAttendanceRates = (meeting) => {
  if (!meeting?.participants || !meeting?.attendanceCheck) {
    return []
  }

  const attendees = meeting.attendanceCheck.attendees || []
  const totalAttendanceChecks = meeting.attendanceCheck.totalChecks || 0

  return meeting.participants
    .filter(p => p.status !== 'owner') // 모임장 제외
    .map(participant => {
      const memberAttendances = attendees.filter(attendee => attendee.userId === participant.userId)
      const attendanceRate = totalAttendanceChecks > 0 
        ? Math.round((memberAttendances.length / totalAttendanceChecks) * 100)
        : 0

      return {
        userId: participant.userId,
        displayName: participant.displayName || `사용자 ${participant.userId}`,
        status: participant.status,
        attendanceCount: memberAttendances.length,
        totalChecks: totalAttendanceChecks,
        attendanceRate: attendanceRate
      }
    })
    .sort((a, b) => b.attendanceRate - a.attendanceRate) // 출석률 높은 순으로 정렬
}

// 최적의 모임 시간 제안 (개선된 알고리즘)
export const getOptimalMeetingTimes = (meeting) => {
  if (import.meta.env.DEV) {
    console.log('getOptimalMeetingTimes called with meeting:', meeting)
  }
  
  if (!meeting?.availability || !meeting?.participants) {
    if (import.meta.env.DEV) {
      console.log('No availability or participants data')
    }
    return []
  }

  const participants = meeting.participants.filter(p => p.status === 'approved' || p.status === 'owner')
  const totalParticipants = participants.length
  
  if (totalParticipants === 0) {
    if (import.meta.env.DEV) {
      console.log('No approved participants')
    }
    return []
  }

  const timeSlots = []
  const weekDays = ['월', '화', '수', '목', '금']
  
  // 시간 슬롯 생성 (9시부터 22시까지, 30분 단위) - 2시간 연속 가능한 시간 찾기
  for (let hour = 9; hour <= 22; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
      timeSlots.push(timeString)
    }
  }

  const optimalTimes = []

  // 각 요일별로 최적 시간 계산 (연속 시간 고려)
  weekDays.forEach((day, dayIndex) => {
    timeSlots.forEach((time, timeIndex) => {
      // 2시간 연속 가능한지 확인 (4개 슬롯 = 2시간)
      const consecutiveSlots = []
      let allAvailable = true
      let totalAvailableCount = 0
      
      for (let i = 0; i < 4 && timeIndex + i < timeSlots.length; i++) {
        const checkSlotId = `${dayIndex}-${timeIndex + i}`
        let slotAvailableCount = 0
        
        participants.forEach(participant => {
          const userSlots = meeting.availability[participant.userId] || []
          if (userSlots.includes(checkSlotId)) {
            slotAvailableCount++
          }
        })
        
        consecutiveSlots.push({
          slotId: checkSlotId,
          time: timeSlots[timeIndex + i],
          availableCount: slotAvailableCount
        })
        
        totalAvailableCount += slotAvailableCount
        
        // 최소 50% 이상 참여자가 가능해야 연속 시간으로 인정
        if (slotAvailableCount < totalParticipants * 0.5) {
          allAvailable = false
        }
      }
      
      // 연속 2시간이 모두 가능한 경우만 고려
      if (consecutiveSlots.length === 4 && allAvailable) {
        const averageAvailabilityRate = (totalAvailableCount / (consecutiveSlots.length * totalParticipants)) * 100
        
        // 시간대별 가중치 적용 (오전 10-12시, 오후 2-5시 선호)
        let timeWeight = 1.0
        const hour = parseInt(time.split(':')[0])
        if ((hour >= 10 && hour < 12) || (hour >= 14 && hour < 17)) {
          timeWeight = 1.2 // 오전/오후 시간대 가중치
        } else if (hour >= 18) {
          timeWeight = 0.9 // 저녁 시간대 약간 낮은 가중치
        }
        
        const weightedScore = averageAvailabilityRate * timeWeight
        
        optimalTimes.push({
          day: day,
          dayIndex: dayIndex,
          time: time,
          endTime: consecutiveSlots[3].time, // 2시간 후
          timeIndex: timeIndex,
          slotId: `${dayIndex}-${timeIndex}`,
          availableCount: Math.round(totalAvailableCount / consecutiveSlots.length), // 평균
          totalParticipants: totalParticipants,
          availabilityRate: Math.round(averageAvailabilityRate),
          weightedScore: Math.round(weightedScore),
          consecutiveSlots: consecutiveSlots.length,
          isConsecutive: true
        })
      } else {
        // 연속 시간이 안되더라도 단일 시간 슬롯도 고려 (가중치 낮게)
        const slotId = `${dayIndex}-${timeIndex}`
        let availableCount = 0

        participants.forEach(participant => {
          const userSlots = meeting.availability[participant.userId] || []
          if (userSlots.includes(slotId)) {
            availableCount++
          }
        })

        const availabilityRate = totalParticipants > 0 ? (availableCount / totalParticipants) * 100 : 0

        // 70% 이상 가능한 단일 시간만 제안
        if (availabilityRate >= 70) {
          optimalTimes.push({
            day: day,
            dayIndex: dayIndex,
            time: time,
            endTime: timeSlots[timeIndex + 1] || time, // 다음 30분 또는 동일
            timeIndex: timeIndex,
            slotId: slotId,
            availableCount: availableCount,
            totalParticipants: totalParticipants,
            availabilityRate: Math.round(availabilityRate),
            weightedScore: Math.round(availabilityRate * 0.8), // 연속 시간보다 낮은 가중치
            consecutiveSlots: 1,
            isConsecutive: false
          })
        }
      }
    })
  })

  // 가중치 점수 순으로 정렬하고 상위 12개만 반환 (연속 시간 우선)
  const result = optimalTimes
    .sort((a, b) => {
      // 연속 시간 우선, 그 다음 가중치 점수
      if (a.isConsecutive !== b.isConsecutive) {
        return b.isConsecutive - a.isConsecutive
      }
      return b.weightedScore - a.weightedScore
    })
    .slice(0, 12)
  
  if (import.meta.env.DEV) {
    console.log('Final optimal times result:', result)
  }
  return result
}

// ==================== 알림 관련 함수 ====================

// 공지사항 알림 생성
export const createAnnouncementNotifications = async (meetingId, announcement, participants) => {
  try {
    if (!db) {
      throw new Error('Firestore 데이터베이스가 초기화되지 않았습니다.')
    }

    const notifications = []
    
    // 승인된 참여자들에게만 알림 전송
    const approvedParticipants = participants.filter(p => 
      p.status === 'approved' || p.status === 'owner'
    )

    for (const participant of approvedParticipants) {
      const notification = {
        userId: participant.userId,
        type: 'announcement',
        title: `새로운 중요 공지사항`,
        message: `${announcement.title}`,
        data: {
          meetingId: meetingId,
          announcementId: announcement.id,
          priority: announcement.priority
        },
        isRead: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }
      
      notifications.push(notification)
    }

    // 배치로 알림 생성
    const batch = notifications.map(notification => 
      addDoc(collection(db, COLLECTIONS.NOTIFICATIONS), notification)
    )
    
    await Promise.all(batch)
    console.log('공지사항 알림 생성 완료:', notifications.length, '개')
  } catch (error) {
    console.error('공지사항 알림 생성 실패:', error)
    throw error
  }
}

// 사용자 알림 구독
export const subscribeToUserNotifications = (userId, callback) => {
  try {
    if (!userId) {
      console.log('사용자 ID가 없어서 알림 구독을 중단합니다.')
      callback([])
      return () => {}
    }

    if (!db) {
      console.error('❌ Firestore 데이터베이스가 초기화되지 않았습니다.')
      callback([])
      return () => {}
    }

    console.log('사용자 알림 구독 시작:', userId)

    const q = query(
      collection(db, COLLECTIONS.NOTIFICATIONS),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    )

    return onSnapshot(q, (snapshot) => {
      console.log('사용자 알림 데이터 변경 감지:', snapshot.docs.length, '개 알림')
      const notifications = snapshot.docs.map(doc => {
        const data = doc.data()
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt)
        }
      })
      callback(notifications)
    }, (error) => {
      console.error('사용자 알림 구독 오류:', error)
      callback([])
    })
  } catch (error) {
    console.error('사용자 알림 구독 초기화 오류:', error)
    callback([])
    return () => {}
  }
}

// 알림 읽음 처리
export const markNotificationAsRead = async (notificationId) => {
  try {
    if (!db) {
      throw new Error('Firestore 데이터베이스가 초기화되지 않았습니다.')
    }

    const notificationRef = doc(db, COLLECTIONS.NOTIFICATIONS, notificationId)
    await updateDoc(notificationRef, {
      isRead: true,
      updatedAt: serverTimestamp()
    })

    console.log('알림 읽음 처리 완료:', notificationId)
  } catch (error) {
    console.error('알림 읽음 처리 실패:', error)
    throw error
  }
}

// 모든 알림 읽음 처리
export const markAllNotificationsAsRead = async (userId) => {
  try {
    if (!db) {
      throw new Error('Firestore 데이터베이스가 초기화되지 않았습니다.')
    }

    const q = query(
      collection(db, COLLECTIONS.NOTIFICATIONS),
      where('userId', '==', userId),
      where('isRead', '==', false)
    )

    const snapshot = await getDocs(q)
    const batch = snapshot.docs.map(doc => 
      updateDoc(doc.ref, {
        isRead: true,
        updatedAt: serverTimestamp()
      })
    )

    await Promise.all(batch)
    console.log('모든 알림 읽음 처리 완료:', snapshot.docs.length, '개')
  } catch (error) {
    console.error('모든 알림 읽음 처리 실패:', error)
    throw error
  }
}

// 사용자 가용성 업데이트
export const updateUserAvailability = async (meetingId, userId, availability) => {
  if (!db) {
    throw new Error('Firebase가 초기화되지 않았습니다.')
  }

  try {
    const meetingRef = doc(db, 'meetings', meetingId)
    
    // 기존 가용성 데이터 가져오기
    const meetingDoc = await getDoc(meetingRef)
    if (!meetingDoc.exists()) {
      throw new Error('모임을 찾을 수 없습니다.')
    }

    const meetingData = meetingDoc.data()
    const currentAvailability = meetingData.availability || {}
    
    // 사용자의 가용성 업데이트
    currentAvailability[userId] = availability

    console.log('일정 조율 업데이트 시작 - 모임 ID:', meetingId)
    console.log('일정 조율 업데이트 - 사용자 ID:', userId)
    console.log('업데이트할 가용성 데이터:', currentAvailability)
    
    // 모임 문서 업데이트
    await updateDoc(meetingRef, {
      availability: currentAvailability,
      updatedAt: serverTimestamp()
    })

    console.log('일정 조율 Firestore 업데이트 완료 - 모임 ID:', meetingId)
    console.log('가용성 업데이트 성공:', userId, availability.length, '개 슬롯')
  } catch (error) {
    console.error('가용성 업데이트 실패:', error)
    throw error
  }
}

// 반복 모임 일정 설정
export const setRecurringMeetingSchedule = async (meetingId, scheduleData) => {
  if (!db) {
    throw new Error('Firebase가 초기화되지 않았습니다.')
  }

  try {
    const meetingRef = doc(db, 'meetings', meetingId)
    
    await updateDoc(meetingRef, {
      recurringSchedule: {
        isRecurring: true,
        frequency: scheduleData.frequency, // 'weekly' or 'biweekly'
        dayOfWeek: scheduleData.dayOfWeek, // 0-6 (일-토)
        startTime: scheduleData.startTime, // HH:mm format
        endTime: scheduleData.endTime, // HH:mm format
        startDate: scheduleData.startDate, // 시작 날짜
        endDate: scheduleData.endDate, // 종료 날짜 (한 학기)
        location: scheduleData.location || '',
        createdAt: serverTimestamp()
      },
      updatedAt: serverTimestamp()
    })

    console.log('반복 모임 일정 설정 성공:', scheduleData)
  } catch (error) {
    console.error('반복 모임 일정 설정 실패:', error)
    throw error
  }
}

// 반복 모임 일정 제거
export const removeRecurringMeetingSchedule = async (meetingId) => {
  if (!db) {
    throw new Error('Firebase가 초기화되지 않았습니다.')
  }

  try {
    const meetingRef = doc(db, 'meetings', meetingId)
    
    await updateDoc(meetingRef, {
      recurringSchedule: null,
      updatedAt: serverTimestamp()
    })

    console.log('반복 모임 일정 제거 성공')
  } catch (error) {
    console.error('반복 모임 일정 제거 실패:', error)
    throw error
  }
}

// 반복 모임 일정을 개인 일정으로 생성
export const createRecurringEventsForParticipants = async (meetingId, meetingData) => {
  if (!db || !meetingData?.recurringSchedule) {
    return
  }

  try {
    const schedule = meetingData.recurringSchedule
    const participants = meetingData.participants?.filter(p => p.status === 'approved' || p.status === 'owner') || []
    
    if (participants.length === 0) {
      return
    }

    const startDate = new Date(schedule.startDate)
    const endDate = new Date(schedule.endDate)
    const events = []

    // 반복 일정 생성
    let currentDate = new Date(startDate)
    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay()
      
      // 요일이 맞는지 확인
      if (dayOfWeek === schedule.dayOfWeek) {
        // Date 객체로 저장 (Firestore가 자동으로 Timestamp로 변환)
        const eventDate = new Date(currentDate)
        eventDate.setHours(0, 0, 0, 0) // 시간을 00:00:00으로 설정
        
        // 각 참여자에 대해 일정 생성
        for (const participant of participants) {
          const eventData = {
            userId: participant.userId,
            title: `${meetingData.title} 모임`,
            description: `정기 모임 - ${meetingData.title}`,
            date: eventDate, // Date 객체로 저장
            time: schedule.startTime,
            endTime: schedule.endTime,
            location: schedule.location || '',
            category: 'meeting',
            meetingId: meetingId,
            isRecurring: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          }
          
          events.push(eventData)
        }
      }
      
      // 다음 주로 이동 (격주인 경우 2주)
      const daysToAdd = schedule.frequency === 'biweekly' ? 14 : 7
      currentDate.setDate(currentDate.getDate() + daysToAdd)
    }

    // 중복 일정 확인 및 제거 (같은 날짜, 같은 사용자, 같은 모임의 일정)
    const uniqueEvents = []
    const eventKeys = new Set()
    
    for (const event of events) {
      const key = `${event.userId}-${event.date.toISOString().split('T')[0]}-${meetingId}`
      if (!eventKeys.has(key)) {
        eventKeys.add(key)
        uniqueEvents.push(event)
      }
    }
    
    if (import.meta.env.DEV) {
      console.log(`반복 일정 생성: ${uniqueEvents.length}개 일정 (중복 제거 전: ${events.length}개)`)
    }
    
    // 모든 일정을 Firestore에 추가
    const batch = writeBatch(db)
      uniqueEvents.forEach(event => {
        const eventRef = doc(collection(db, COLLECTIONS.EVENTS))
        batch.set(eventRef, event)
      })
    
    await batch.commit()
    if (import.meta.env.DEV) {
      console.log('반복 모임 일정 생성 완료:', uniqueEvents.length, '개 일정')
    }
    
    // 이벤트 구독이 실시간으로 업데이트되도록 약간의 지연 추가
    await new Promise(resolve => setTimeout(resolve, 100))
    
  } catch (error) {
    console.error('반복 모임 일정 생성 실패:', error)
    throw error
  }
}

// 반복 모임 일정을 개인 일정에서 제거
export const removeRecurringEventsForParticipants = async (meetingId) => {
  if (!db) {
    return
  }

  try {
    const eventsQuery = query(
      collection(db, 'events'),
      where('meetingId', '==', meetingId),
      where('isRecurring', '==', true)
    )
    
    const eventsSnapshot = await getDocs(eventsQuery)
    const batch = writeBatch(db)
    
    eventsSnapshot.forEach(doc => {
      batch.delete(doc.ref)
    })
    
    await batch.commit()
    console.log('반복 모임 일정 제거 완료:', eventsSnapshot.size, '개 일정')
    
  } catch (error) {
    console.error('반복 모임 일정 제거 실패:', error)
    throw error
  }
}

// ==================== 날짜별 출석 관리 함수 ====================

// 날짜별 출석 기록 가져오기
export const getAttendanceHistory = (meeting) => {
  if (!meeting?.attendanceHistory) {
    return []
  }

  const history = Object.entries(meeting.attendanceHistory)
    .map(([date, record]) => ({
      date,
      ...record,
      // 날짜별 출석률 계산
      attendanceRate: calculateDateAttendanceRate(record, meeting.participants),
      // 총 참여자 수 (승인된 참여자만, 소유자 제외)
      totalParticipants: meeting.participants?.filter(p => p.status === 'approved').length || 0
    }))
    .sort((a, b) => new Date(b.date) - new Date(a.date)) // 최신 날짜순

  return history
}

// 특정 날짜의 출석 기록 가져오기
export const getAttendanceRecordByDate = (meeting, date) => {
  if (!meeting?.attendanceHistory || !date) {
    return null
  }

  const record = meeting.attendanceHistory[date]
  if (!record) {
    return null
  }

  return {
    date,
    ...record,
    attendanceRate: calculateDateAttendanceRate(record, meeting.participants),
    totalParticipants: meeting.participants?.filter(p => p.status === 'approved').length || 0
  }
}

// 날짜별 출석률 계산
const calculateDateAttendanceRate = (record, participants) => {
  if (!record?.attendees || !participants) {
    return 0
  }

  const totalParticipants = participants.filter(p => p.status === 'approved').length
  if (totalParticipants === 0) {
    return 0
  }

  return Math.round((record.attendees.length / totalParticipants) * 100)
}

// 날짜별 출석 통계 가져오기
export const getAttendanceStatistics = (meeting) => {
  const history = getAttendanceHistory(meeting)
  
  if (history.length === 0) {
    return {
      totalSessions: 0,
      averageAttendanceRate: 0,
      bestAttendanceRate: 0,
      worstAttendanceRate: 0,
      totalAttendances: 0
    }
  }

  const attendanceRates = history.map(record => record.attendanceRate)
  const totalAttendances = history.reduce((sum, record) => sum + record.attendees.length, 0)

  return {
    totalSessions: history.length,
    averageAttendanceRate: Math.round(attendanceRates.reduce((sum, rate) => sum + rate, 0) / attendanceRates.length),
    bestAttendanceRate: Math.max(...attendanceRates),
    worstAttendanceRate: Math.min(...attendanceRates),
    totalAttendances
  }
}

// 특정 사용자의 출석 기록 가져오기
export const getUserAttendanceHistory = (meeting, userId) => {
  const history = getAttendanceHistory(meeting)
  
  return history.map(record => ({
    date: record.date,
    attended: record.attendees?.some(attendee => attendee.userId === userId) || false,
    attendanceTime: record.attendees?.find(attendee => attendee.userId === userId)?.timestamp || null
  }))
}

// 사용자별 출석률 계산
export const getUserAttendanceRate = (meeting, userId) => {
  const userHistory = getUserAttendanceHistory(meeting, userId)
  const totalSessions = userHistory.length
  
  if (totalSessions === 0) {
    return 0
  }
  
  const attendedSessions = userHistory.filter(record => record.attended).length
  return Math.round((attendedSessions / totalSessions) * 100)
}

// ==================== 최적 모임 시간 제안 및 자동 일정 생성 ====================

// 제안된 시간으로 모임 일정 자동 생성
export const createMeetingScheduleFromSuggestion = async (meetingId, suggestion, userId) => {
  try {
    if (!db) {
      throw new Error('Firebase가 초기화되지 않았습니다')
    }

    const meetingRef = doc(db, COLLECTIONS.MEETINGS, meetingId)
    
    // 현재 모임 데이터를 가져와서 소유자인지 확인
    const meetingDoc = await getDoc(meetingRef)
    if (!meetingDoc.exists()) {
      throw new Error('모임을 찾을 수 없습니다')
    }
    
    const meetingData = meetingDoc.data()
    if (meetingData.owner !== userId) {
      throw new Error('모임 소유자만 일정을 생성할 수 있습니다')
    }

    // 제안된 날짜 계산 (다음 주 해당 요일)
    const suggestedDate = calculateSuggestedDate(suggestion.dayIndex, suggestion.time)
    
    // 종료 시간 계산 (연속 시간이 있으면 사용, 없으면 기본 2시간)
    const endTime = suggestion.endTime || calculateEndTime(suggestion.time, suggestion.isConsecutive ? (suggestion.consecutiveSlots * 30 / 60) : 2)
    
    // 모임 일정 데이터 생성
    const scheduleData = {
      date: suggestedDate,
      startTime: suggestion.time,
      endTime: endTime,
      duration: suggestion.isConsecutive ? (suggestion.consecutiveSlots * 30) : 120, // 분 단위
      location: meetingData.location || '',
      title: `${meetingData.title} 모임`,
      description: `최적 시간 제안으로 생성된 모임 일정`,
      isSuggested: true,
      suggestionData: suggestion
    }

    // 모임에 일정 정보 추가
    await updateDoc(meetingRef, {
      suggestedSchedule: scheduleData,
      updatedAt: serverTimestamp()
    })

    // 모든 참여자의 개인 일정에 추가
    const participants = meetingData.participants?.filter(p => p.status === 'approved' || p.status === 'owner') || []
    
    if (participants.length > 0) {
      const batch = writeBatch(db)
      
      participants.forEach(participant => {
        const eventData = {
          userId: participant.userId,
          title: `${meetingData.title} 모임`,
          description: `최적 시간 제안으로 생성된 모임 일정 - ${meetingData.title}`,
          date: suggestedDate,
          time: suggestion.time,
          endTime: endTime,
          duration: scheduleData.duration,
          location: meetingData.location || '',
          category: 'meeting',
          meetingId: meetingId,
          isSuggested: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }
        
        const eventRef = doc(collection(db, 'events'))
        batch.set(eventRef, eventData)
      })
      
      await batch.commit()
    }

    console.log('제안된 시간으로 모임 일정 생성 완료:', scheduleData)
    return scheduleData
  } catch (error) {
    console.error('모임 일정 생성 실패:', error)
    throw error
  }
}

// 제안된 날짜 계산 (다음 주 해당 요일)
const calculateSuggestedDate = (dayIndex, time) => {
  const today = new Date()
  const currentDay = today.getDay()
  const currentHour = parseInt(time.split(':')[0])
  const currentMinute = parseInt(time.split(':')[1])
  
  // 현재 시간이 제안 시간보다 늦으면 다음 주, 아니면 이번 주
  const isPastTime = today.getHours() > currentHour || 
    (today.getHours() === currentHour && today.getMinutes() > currentMinute)
  
  const daysUntilTarget = (dayIndex - currentDay + 7) % 7
  const targetDate = new Date(today)
  
  if (isPastTime && daysUntilTarget === 0) {
    // 오늘이지만 시간이 지났으면 다음 주
    targetDate.setDate(today.getDate() + 7)
  } else if (daysUntilTarget === 0 && !isPastTime) {
    // 오늘이고 시간이 안 지났으면 오늘
    targetDate.setDate(today.getDate())
  } else {
    // 다른 요일이면 해당 요일로
    targetDate.setDate(today.getDate() + daysUntilTarget)
  }
  
  return targetDate.toISOString().split('T')[0]
}

// 종료 시간 계산
const calculateEndTime = (startTime, durationHours) => {
  const [hours, minutes] = startTime.split(':').map(Number)
  const endMinutes = hours * 60 + minutes + durationHours * 60
  
  const endHours = Math.floor(endMinutes / 60)
  const endMins = endMinutes % 60
  
  return `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`
}

// 제안된 일정 제거
export const removeSuggestedSchedule = async (meetingId, userId) => {
  try {
    if (!db) {
      throw new Error('Firebase가 초기화되지 않았습니다')
    }

    const meetingRef = doc(db, COLLECTIONS.MEETINGS, meetingId)
    
    // 현재 모임 데이터를 가져와서 소유자인지 확인
    const meetingDoc = await getDoc(meetingRef)
    if (!meetingDoc.exists()) {
      throw new Error('모임을 찾을 수 없습니다')
    }
    
    const meetingData = meetingDoc.data()
    if (meetingData.owner !== userId) {
      throw new Error('모임 소유자만 일정을 제거할 수 있습니다')
    }

    // 제안된 일정 관련 이벤트들 삭제
    const eventsQuery = query(
      collection(db, 'events'),
      where('meetingId', '==', meetingId),
      where('isSuggested', '==', true)
    )
    
    const eventsSnapshot = await getDocs(eventsQuery)
    const batch = writeBatch(db)
    
    eventsSnapshot.forEach(doc => {
      batch.delete(doc.ref)
    })
    
    await batch.commit()

    // 모임에서 제안된 일정 정보 제거
    await updateDoc(meetingRef, {
      suggestedSchedule: null,
      updatedAt: serverTimestamp()
    })

    console.log('제안된 일정 제거 완료')
  } catch (error) {
    console.error('제안된 일정 제거 실패:', error)
    throw error
  }
}
