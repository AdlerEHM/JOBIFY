import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyAReLeJ4fIMhjmTQMy6fgOpkEn9ebspjTU",
    authDomain: "jobify-392f2.firebaseapp.com",
    projectId: "jobify-392f2",
    storageBucket: "jobify-392f2.firebasestorage.app",
    messagingSenderId: "508357161570",
    appId: "1:508357161570:web:3137bb4e917e2e0552173b"
};

const app     = initializeApp(firebaseConfig);
const auth    = getAuth(app);
const db      = getFirestore(app);
const storage = getStorage(app);

const TAGS = [
    "Python", "Java", "SQL", "C#", "C++", "JavaScript", "PHP",
    "Swift", "Kotlin", "Dart", "Go", "Ruby", "HTML", "CSS",
    "TypeScript", "Scala", "R", "MATLAB", "Julia"
];

let selectedTags  = [];
let rolUsuario    = "";
let usuarioActual = null;

// ─── INICIO ───────────────────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = "index.html"; return; }
    usuarioActual = user;

    const docSnap  = await getDoc(doc(db, "usuarios", user.uid));
    if (!docSnap.exists()) { window.location.href = "index.html"; return; }

    const userData = docSnap.data();
    rolUsuario     = userData.rol;

    // Título según rol
    document.getElementById('perfilTitulo').innerText =
        userData.perfilCompleto ? "Editar Perfil" : "Configura tu Perfil";

    // Cargar datos existentes
    if (userData.nombre) document.getElementById('displayName').value = userData.nombre;

    // Foto de perfil actual
    if (userData.foto) {
        const preview     = document.getElementById('fotoPreview');
        const placeholder = document.getElementById('fotoPlaceholder');
        preview.src               = userData.foto;
        preview.style.display     = 'block';
        placeholder.style.display = 'none';
    }

    // Mostrar campos según rol
    if (rolUsuario === "Empresa") {
        document.getElementById('companyFields').style.display = "block";
        if (userData.descripcion) document.getElementById('companyBio').value = userData.descripcion;
    } else {
        document.getElementById('devFields').style.display = "block";
        selectedTags = userData.habilidades || [];
        if (userData.pagoSugerido) document.getElementById('payRange').value = userData.pagoSugerido;
        renderTags();
    }
});

// ─── RENDER TAGS ──────────────────────────────────────────────────────────
function renderTags() {
    const cloud = document.getElementById('skillsCloud');
    cloud.innerHTML = "";
    TAGS.forEach(tag => {
        const span       = document.createElement('span');
        span.innerText   = tag;
        span.className   = 'skill-tag' + (selectedTags.includes(tag) ? ' selected' : '');
        span.onclick = () => {
            if (selectedTags.includes(tag)) {
                selectedTags = selectedTags.filter(t => t !== tag);
                span.classList.remove('selected');
            } else {
                selectedTags.push(tag);
                span.classList.add('selected');
            }
        };
        cloud.appendChild(span);
    });
}

// ─── PREVIEW DE IMAGEN ────────────────────────────────────────────────────
document.getElementById('profileImage').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        const preview     = document.getElementById('fotoPreview');
        const placeholder = document.getElementById('fotoPlaceholder');
        preview.src               = ev.target.result;
        preview.style.display     = 'block';
        placeholder.style.display = 'none';
    };
    reader.readAsDataURL(file);
});

// ─── CONTADOR DE PALABRAS ─────────────────────────────────────────────────
const bioEl = document.getElementById('companyBio');
if (bioEl) {
    bioEl.addEventListener('input', () => {
        const palabras = bioEl.value.trim() === '' ? 0 : bioEl.value.trim().split(/\s+/).length;
        const counter  = document.getElementById('bioCounter');
        if (counter) {
            counter.innerText = `${palabras} / 1000 palabras`;
            counter.style.color = palabras > 1000 ? '#DC2626' : '#aaa';
        }
    });
}

// ─── GUARDAR PERFIL ───────────────────────────────────────────────────────
document.getElementById('btnSaveProfile').onclick = async () => {
    const user   = usuarioActual;
    if (!user)   return;

    const nombre = document.getElementById('displayName').value.trim();
    const file   = document.getElementById('profileImage').files[0];
    const btn    = document.getElementById('btnSaveProfile');

    // Validaciones
    if (!nombre) return mostrarError("El nombre es obligatorio.");

    if (rolUsuario === "Empresa") {
        const bio     = document.getElementById('companyBio').value.trim();
        const palabras = bio === '' ? 0 : bio.trim().split(/\s+/).length;
        if (palabras > 1000) return mostrarError("La descripción no debe exceder las 1000 palabras.");
    } else {
        if (selectedTags.length === 0) return mostrarError("Selecciona al menos una habilidad.");
    }

    btn.innerText = "Guardando...";
    btn.disabled  = true;

    try {
        let imageUrl = "";

        // Subir imagen si se seleccionó una
        if (file) {
            const status  = document.getElementById('uploadStatus');
            status.innerText = "Subiendo imagen...";
            const storageRef = ref(storage, `perfiles/${user.uid}`);
            await uploadBytes(storageRef, file);
            imageUrl = await getDownloadURL(storageRef);
            status.innerText = "";
        }

        // Datos base
        const updateData = {
            nombre,
            perfilCompleto: true,
            reputacion:     (await getDoc(doc(db, "usuarios", user.uid))).data()?.reputacion   || 5,
            totalValores:   (await getDoc(doc(db, "usuarios", user.uid))).data()?.totalValores || 0
        };

        if (imageUrl) updateData.foto = imageUrl;

        // Datos según rol
        if (rolUsuario === "Empresa") {
            updateData.descripcion = document.getElementById('companyBio').value.trim();
        } else {
            updateData.habilidades   = selectedTags;
            updateData.pagoSugerido  = document.getElementById('payRange').value || "0";
        }

        await updateDoc(doc(db, "usuarios", user.uid), updateData);

        alert("✅ Perfil guardado con éxito.");
        window.location.href = "dashboard.html";

    } catch (error) {
        mostrarError("Error al guardar: " + error.message);
        btn.innerText = "Guardar Perfil";
        btn.disabled  = false;
    }
};

// ─── MOSTRAR ERROR ────────────────────────────────────────────────────────
function mostrarError(msg) {
    const el = document.getElementById('errorMsg');
    el.innerText = msg;
    el.style.display = 'block';
    setTimeout(() => el.style.display = 'none', 4000);
}