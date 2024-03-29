import { initializeApp } from "firebase/app";
import  { getFireStore } from 'firebase/firestore'

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBaX316jbaQ3SniUKSTbvRMWSOmT3my2xU",
  authDomain: "house-marketplace-app-b18c9.firebaseapp.com",
  projectId: "house-marketplace-app-b18c9",
  storageBucket: "house-marketplace-app-b18c9.appspot.com",
  messagingSenderId: "969440456545",
  appId: "1:969440456545:web:3f5ce8d2af6030c0505f20"
};

// Initialize Firebase
initializeApp(firebaseConfig);
export const db = getFirestore()