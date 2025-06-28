// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyChK7gtLlJ5KdIQ11PFy_M3YwkXYxUssB8",
  authDomain: "genzdb-e5216.firebaseapp.com",
  projectId: "genzdb-e5216",
  storageBucket: "genzdb-e5216.firebasestorage.app",
  messagingSenderId: "789310114421",
  appId: "1:789310114421:web:6c17e005bd7b36b754463c",
  measurementId: "G-L7MPTRLEDF"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
if (firebase.analytics) {
  firebase.analytics();
}

const db = firebase.firestore();

// Oturumun kalıcı olması için persistence ayarı
// DEBUG: Persistence ve Auth durumunu detaylı logla
firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
  .then(function() {
    console.log('[Firebase][DEBUG] Auth persistence LOCAL olarak ayarlandı.');
    // Persistence ayarlandıktan sonra mevcut kullanıcıyı logla
    const user = firebase.auth().currentUser;
    if (user) {
      console.log('[Firebase][DEBUG] Persistence sonrası mevcut kullanıcı:', user.email, user.uid);
    } else {
      console.log('[Firebase][DEBUG] Persistence sonrası kullanıcı yok.');
    }
  })
  .catch(function(error) {
    alert('[Firebase] setPersistence hatası: ' + error.message);
    console.error('[Firebase] setPersistence hatası:', error);
  });

// DEBUG: Her yüklemede mevcut kullanıcıyı logla
setTimeout(() => {
  const user = firebase.auth().currentUser;
  if (user) {
    console.log('[Firebase][DEBUG] Sayfa yüklemede mevcut kullanıcı:', user.email, user.uid);
  } else {
    console.log('[Firebase][DEBUG] Sayfa yüklemede kullanıcı yok.');
  }
}, 1000);

// firebase.auth().onAuthStateChanged fonksiyonu kaldırıldı, sadece main.js'de kullanılacak
