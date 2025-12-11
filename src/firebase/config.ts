import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getDatabase } from 'firebase/database'

// Your web app's Firebase configuration
// Replace these values with your Firebase project config
const firebaseConfig = {
  apiKey: "AIzaSyCya3cxa1x8LvB5Vr0QUjMS5rCqXav4-do",
  authDomain: "tcc-9aa6a.firebaseapp.com",
  projectId: "tcc-9aa6a",
  storageBucket: "tcc-9aa6a.firebasestorage.app",
  messagingSenderId: "793727450812",
  appId: "1:793727450812:web:b19ca79a600ae748e11ab9",
  databaseURL: "https://tcc-9aa6a-default-rtdb.asia-southeast1.firebasedatabase.app/",
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Initialize Firebase services
export const auth = getAuth(app)
export const database = getDatabase(app)
export default app

