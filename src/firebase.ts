import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAUH4_VSPwZ_hscy6r6BvCubgHYRnF7A7g",
  authDomain: "planner-res.firebaseapp.com",
  projectId: "planner-res",
  storageBucket: "planner-res.firebasestorage.app",
  messagingSenderId: "973122809890",
  appId: "1:973122809890:web:2accd811066e7bff851a7b"
};

// Инициализируем подключение
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);