import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// Tu configuración (Asegúrate de que storageBucket esté bien)
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
const storage = getStorage(app); // RQNF23: Inicializamos el almacenamiento

const tags = ["Python", "Java", "SQL", "C#", "C++", "JavaScript", "PHP", "Swift", "Kotlin", "Dart", "Go", "Ruby", "HTML", "CSS", "TypeScript", "Scala", "R", "MATLAB", "Julia"];
let selectedTags = [];

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const docSnap = await getDoc(doc(db, "usuarios", user.uid));
        const userData = docSnap.data();
        if (userData.rol === "Empresa") {
            document.getElementById('companyFields').style.display = "block";
        } else {
            document.getElementById('devFields').style.display = "block";
            renderTags(); // RQNF07: Las 19 etiquetas obligatorias
        }
    } else {
        window.location.href = "index.html";
    }
});

function renderTags() {
    const cloud = document.getElementById('skillsCloud');
    cloud.innerHTML = "";
    tags.forEach(tag => {
        const span = document.createElement('span');
        span.innerText = tag;
        span.className = 'skill-tag';
        span.onclick = () => {
            span.classList.toggle('selected');
            if(selectedTags.includes(tag)) {
                selectedTags = selectedTags.filter(t => t !== tag);
            } else {
                selectedTags.push(tag);
            }
        };
        cloud.appendChild(span);
    });
}

// RQF009: Guardar perfil y portafolio
document.getElementById('btnSaveProfile').onclick = async () => {
    const user = auth.currentUser;
    const name = document.getElementById('displayName').value;
    const bio = document.getElementById('companyBio').value;
    const file = document.getElementById('profileImage').files[0];
    const status = document.getElementById('uploadStatus');
    
    let imageUrl = "";

    try {
        // 1. Subida de imagen al Storage
        if (file) {
            status.innerText = "Subiendo imagen...";
            const storageRef = ref(storage, `perfiles/${user.uid}`);
            await uploadBytes(storageRef, file);
            imageUrl = await getDownloadURL(storageRef);
            status.innerText = "¡Imagen subida!";
        }

        // 2. Preparación de datos
        const updateData = { 
            nombre: name,
            perfilCompleto: true 
        };

        if (imageUrl) updateData.foto = imageUrl;

        // 3. Validación de campos según el Rol
        if (selectedTags.length > 0) {
            updateData.habilidades = selectedTags; 
            updateData.pagoSugerido = document.getElementById('payRange').value; 
        } else {
            if (bio.trim().split(/\s+/).length > 1000) {
                return alert("La descripción no debe exceder las 1000 palabras.");
            }
            updateData.descripcion = bio; 
        }

        // 4. Guardado en Firestore y Redirección
        await updateDoc(doc(db, "usuarios", user.uid), updateData);
        alert("Perfil guardado con éxito.");
        
        window.location.href = "dashboard.html"; // Redirección final
        
    } catch (error) {
        alert("Error: " + error.message);
    }
};