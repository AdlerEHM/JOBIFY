import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAReLeJ4fIMhjmTQMy6fgOpkEn9ebspjTU",
    authDomain: "jobify-392f2.firebaseapp.com",
    projectId: "jobify-392f2",
    storageBucket: "jobify-392f2.firebasestorage.app",
    messagingSenderId: "508357161570",
    appId: "1:508357161570:web:3137bb4e917e2e0552173b"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

onAuthStateChanged(auth, (user) => {
    if (!user) window.location.href = "index.html";
});

document.getElementById('btnPublish').onclick = async () => {
    const user = auth.currentUser;
    
    const proyecto = {
        titulo: document.getElementById('projTitle').value,
        presupuesto: document.getElementById('projBudget').value,
        nivel: document.getElementById('projLevel').value,
        duracionSemanas: document.getElementById('projDuration').value,
        descripcion: document.getElementById('projDesc').value,
        empresaId: user.uid,
        estado: "activo",
        fechaPublicacion: new Date().toISOString()
    };

    try {
        await addDoc(collection(db, "proyectos"), proyecto);
        alert("¡Proyecto publicado con éxito!");
        window.location.href = "dashboard.html";
    } catch (error) {
        alert("Error al publicar: " + error.message);
    }
};