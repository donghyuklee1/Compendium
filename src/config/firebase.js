import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

// Firebase 설정 (환경 변수에서 가져옴)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "demo-api-key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "demo-project.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "demo-project",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "demo-project.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "demo-app-id"
}

// Firebase 설정 검증
const validateFirebaseConfig = () => {
  const requiredFields = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId']
  const missingFields = requiredFields.filter(field => !firebaseConfig[field] || firebaseConfig[field].includes('demo-'))
  
  if (missingFields.length > 0) {
    if (import.meta.env.DEV) {
      console.error('❌ Firebase 설정이 완료되지 않았습니다!')
      console.error('누락된 필드:', missingFields)
      console.error('해결 방법:')
      console.error('1. Firebase Console (https://console.firebase.google.com/)에서 프로젝트 생성')
      console.error('2. 프로젝트 설정 > 일반 탭에서 웹 앱 추가')
      console.error('3. Firebase SDK 설정에서 설정값 복사')
      console.error('4. .env.local 파일에 환경 변수 설정')
      console.error('5. 개발 서버 재시작')
    }
    return false
  }
  
  if (import.meta.env.DEV) {
    console.log('✅ Firebase 설정이 완료되었습니다!')
  }
  return true
}

// Firebase 앱 초기화
const app = initializeApp(firebaseConfig)

// Auth 인스턴스
export const auth = getAuth(app)

// Firestore 인스턴스
export const db = getFirestore(app)

// Firebase 연결 상태 확인
export const checkFirebaseConnection = () => {
  if (import.meta.env.DEV) {
    console.log('Firebase 설정 확인:')
    console.log('- Project ID:', firebaseConfig.projectId)
    console.log('- Auth Domain:', firebaseConfig.authDomain)
    console.log('- API Key:', firebaseConfig.apiKey ? '설정됨' : '누락')
    console.log('- App ID:', firebaseConfig.appId ? '설정됨' : '누락')
  }
  
  // 설정 검증 실행
  const isValid = validateFirebaseConfig()
  
  if (!isValid && import.meta.env.DEV) {
    console.warn('⚠️ Firebase가 제대로 설정되지 않아 일부 기능이 작동하지 않을 수 있습니다.')
  }
  
  return isValid
}

// Google Auth Provider
export const googleProvider = new GoogleAuthProvider()
// KAIST 도메인 제한 제거 - 모든 Gmail 계정 허용

// 인증 함수들
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider)
    return result.user
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('Google 로그인 오류:', error)
    }
    throw error
  }
}

export const signOutUser = async () => {
  try {
    await signOut(auth)
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('로그아웃 오류:', error)
    }
    throw error
  }
}

export default app
