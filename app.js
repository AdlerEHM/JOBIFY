import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
    getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
    sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAReLeJ4fIMhjmTQMy6fgOpkEn9ebspjTU",
    authDomain: "jobify-392f2.firebaseapp.com",
    projectId: "jobify-392f2",
    storageBucket: "jobify-392f2.firebasestorage.app",
    messagingSenderId: "508357161570",
    appId: "1:508357161570:web:3137bb4e917e2e0552173b"
};

const app      = initializeApp(firebaseConfig);
const auth     = getAuth(app);
const db       = getFirestore(app);
const provider = new GoogleAuthProvider();

let modoActual     = "login";
let rolSeleccionado = "";

// ─── MENSAJES DE ERROR EN ESPAÑOL ────────────────────────────────────────
function traducirError(code) {
    const errores = {
        "auth/invalid-email":          "El correo electrónico no es válido.",
        "auth/user-not-found":         "No existe una cuenta con ese correo.",
        "auth/wrong-password":         "Contraseña incorrecta.",
        "auth/email-already-in-use":   "Ya existe una cuenta con ese correo.",
        "auth/weak-password":          "La contraseña debe tener al menos 6 caracteres.",
        "auth/too-many-requests":      "Demasiados intentos fallidos. Intenta más tarde.",
        "auth/network-request-failed": "Error de conexión. Revisa tu internet.",
        "auth/invalid-credential":     "Correo o contraseña incorrectos.",
        "auth/popup-closed-by-user":   "Cerraste la ventana de Google antes de completar."
    };
    return errores[code] || "Ocurrió un error. Intenta de nuevo.";
}

// ─── MOSTRAR ERROR ────────────────────────────────────────────────────────
function mostrarError(msg) {
    const el = document.getElementById('errorMsg');
    el.innerText = msg;
    el.style.display = 'block';
    setTimeout(() => el.style.display = 'none', 4000);
}

// ─── SI YA ESTÁ LOGUEADO → REDIRIGIR ─────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
    if (user) await redireccionarUsuario(user);
});

// ─── TABS ────────────────────────────────────────────────────────────────
document.getElementById('btnTabLogin').onclick = () => {
    modoActual = "login";
    document.getElementById('roleSelection').style.display  = "none";
    document.getElementById('btnSubmit').innerText          = "Iniciar Sesión";
    document.getElementById('btnTabLogin').classList.add('active');
    document.getElementById('btnTabRegister').classList.remove('active');
    document.getElementById('errorMsg').style.display       = 'none';
};

document.getElementById('btnTabRegister').onclick = () => {
    modoActual = "registro";
    document.getElementById('roleSelection').style.display  = "flex";
    document.getElementById('btnSubmit').innerText          = "Registrarse";
    document.getElementById('btnTabRegister').classList.add('active');
    document.getElementById('btnTabLogin').classList.remove('active');
    document.getElementById('errorMsg').style.display       = 'none';
};

// ─── SELECCIÓN DE ROL ────────────────────────────────────────────────────
document.getElementById('roleEmpresa').onclick = () => {
    rolSeleccionado = "Empresa";
    document.getElementById('roleEmpresa').classList.add('selected');
    document.getElementById('roleProgramador').classList.remove('selected');
};

document.getElementById('roleProgramador').onclick = () => {
    rolSeleccionado = "Programador";
    document.getElementById('roleProgramador').classList.add('selected');
    document.getElementById('roleEmpresa').classList.remove('selected');
};

// ─── SUBMIT PRINCIPAL ────────────────────────────────────────────────────
document.getElementById('btnSubmit').onclick = async () => {
    const correo = document.getElementById('email').value.trim();
    const pass   = document.getElementById('password').value;
    const btn    = document.getElementById('btnSubmit');

    if (!correo) return mostrarError("Escribe tu correo electrónico.");
    if (!pass)   return mostrarError("Escribe tu contraseña.");

    if (modoActual === "registro") {
        if (!rolSeleccionado) return mostrarError("Selecciona si eres Empresa o Programador.");
        if (pass.length < 6)  return mostrarError("La contraseña debe tener al menos 6 caracteres.");

        btn.innerText = "Registrando...";
        btn.disabled  = true;

        try {
            const credencial = await createUserWithEmailAndPassword(auth, correo, pass);
            await setDoc(doc(db, "usuarios", credencial.user.uid), {
                uid:            credencial.user.uid,
                email:          correo,
                rol:            rolSeleccionado,
                perfilCompleto: false,
                reputacion:     5,
                totalValores:   0
            });
            await redireccionarUsuario(credencial.user);
        } catch (error) {
            mostrarError(traducirError(error.code));
            btn.innerText = "Registrarse";
            btn.disabled  = false;
        }

    } else {
        btn.innerText = "Iniciando...";
        btn.disabled  = true;

        try {
            const credencial = await signInWithEmailAndPassword(auth, correo, pass);
            await redireccionarUsuario(credencial.user);
        } catch (error) {
            mostrarError(traducirError(error.code));
            btn.innerText = "Iniciar Sesión";
            btn.disabled  = false;
        }
    }
};

// ─── GOOGLE SIGN-IN ───────────────────────────────────────────────────────
document.getElementById('btnGoogle').onclick = async () => {
    // En registro requiere rol seleccionado
    if (modoActual === "registro" && !rolSeleccionado) {
        return mostrarError("Selecciona si eres Empresa o Programador antes de continuar con Google.");
    }

    try {
        const resultado  = await signInWithPopup(auth, provider);
        const user       = resultado.user;
        const docSnap    = await getDoc(doc(db, "usuarios", user.uid));

        if (!docSnap.exists()) {
            // Primera vez con Google → crear documento
            await setDoc(doc(db, "usuarios", user.uid), {
                uid:            user.uid,
                email:          user.email,
                rol:            rolSeleccionado || "Programador",
                nombre:         user.displayName || "",
                foto:           user.photoURL    || "",
                perfilCompleto: false,
                reputacion:     5,
                totalValores:   0
            });
        }

        await redireccionarUsuario(user);
    } catch (error) {
        mostrarError(traducirError(error.code));
    }
};

// ─── RECUPERAR CONTRASEÑA ────────────────────────────────────────────────
document.getElementById('btnRecover').onclick = async (e) => {
    e.preventDefault();
    const correo = document.getElementById('email').value.trim();
    if (!correo) return mostrarError("Escribe tu correo para recuperar la contraseña.");
    try {
        await sendPasswordResetEmail(auth, correo);
        mostrarError("✅ Correo de recuperación enviado. Revisa tu bandeja.");
    } catch (error) {
        mostrarError(traducirError(error.code));
    }
};

// ─── REDIRECCIÓN ─────────────────────────────────────────────────────────
async function redireccionarUsuario(user) {
    const docSnap = await getDoc(doc(db, "usuarios", user.uid));
    if (docSnap.exists() && docSnap.data().perfilCompleto) {
        window.location.href = "dashboard.html";
    } else {
        window.location.href = "perfil.html";
    }
}