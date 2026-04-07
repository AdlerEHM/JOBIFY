import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAReLeJ4fIMhjmTQMy6fgOpkEn9ebspjTU",
  authDomain: "jobify-392f2.firebaseapp.com",
  projectId: "jobify-392f2",
  storageBucket: "jobify-392f2.firebasestorage.app",
  messagingSenderId: "508357161570",
  appId: "1:508357161570:web:3137bb4e917e2e0552173b",
  measurementId: "G-MPDKJZYPSS"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let modoActual = "registro"; 
let rolSeleccionado = ""; 

// --- INTERFAZ ---

document.getElementById('btnTabLogin').onclick = () => {
    modoActual = "login";
    if(document.getElementById('formTitle')) document.getElementById('formTitle').innerText = "Bienvenido";
    document.getElementById('roleSelection').style.display = "none";
    document.getElementById('btnSubmit').innerText = "Iniciar Sesión";
    document.getElementById('btnTabLogin').classList.add('active');
    document.getElementById('btnTabRegister').classList.remove('active');
};

document.getElementById('btnTabRegister').onclick = () => {
    modoActual = "registro";
    if(document.getElementById('formTitle')) document.getElementById('formTitle').innerText = "Crear Cuenta";
    document.getElementById('roleSelection').style.display = "flex"; // Cambiado a flex para diseño pro
    document.getElementById('btnSubmit').innerText = "Registrarse";
    document.getElementById('btnTabRegister').classList.add('active');
    document.getElementById('btnTabLogin').classList.remove('active');
};

document.getElementById('roleEmpresa').onclick = () => {
    rolSeleccionado = "Empresa";
    actualizarSeleccionRoles();
};

document.getElementById('roleProgramador').onclick = () => {
    rolSeleccionado = "Programador";
    actualizarSeleccionRoles();
};

function actualizarSeleccionRoles() {
    document.getElementById('roleEmpresa').classList.toggle('selected', rolSeleccionado === "Empresa");
    document.getElementById('roleProgramador').classList.toggle('selected', rolSeleccionado === "Programador");
}

// --- LÓGICA DE FIREBASE ---

document.getElementById('btnSubmit').onclick = async () => {
    const correo = document.getElementById('email').value;
    const pass = document.getElementById('password').value;

    if (modoActual === "registro") {
        if (!rolSeleccionado) return alert("Selecciona si eres Empresa o Programador.");
        try {
            const credencial = await createUserWithEmailAndPassword(auth, correo, pass);
            await setDoc(doc(db, "usuarios", credencial.user.uid), {
                uid: credencial.user.uid,
                email: correo,
                rol: rolSeleccionado,
                perfilCompleto: false, // Importante para la redirección
                reputacion: 5
            });
            redireccionarUsuario(credencial.user);
        } catch (error) { alert("Error: " + error.message); }
    } else {
        try {
            const credencial = await signInWithEmailAndPassword(auth, correo, pass);
            redireccionarUsuario(credencial.user);
        } catch (error) { alert("Error: " + error.message); }
    }
};

document.getElementById('btnRecover').onclick = async (e) => {
    e.preventDefault();
    const correo = document.getElementById('email').value;
    if (!correo) return alert("Escribe tu correo.");
    try {
        await sendPasswordResetEmail(auth, correo);
        alert("Correo de recuperación enviado.");
    } catch (error) { alert(error.message); }
};

async function redireccionarUsuario(user) {
    const docSnap = await getDoc(doc(db, "usuarios", user.uid));
    if (docSnap.exists() && docSnap.data().perfilCompleto) {
        window.location.href = "dashboard.html";
    } else {
        window.location.href = "perfil.html";
    }
}