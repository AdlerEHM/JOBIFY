import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
    getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
    sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, addDoc, collection, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
    if (user && !sessionStorage.getItem('esperando2FA')) {
        await redireccionarUsuario(user);
    }
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

// ─── SEGURIDAD ───────────────────────────────────────────────────────────
const MAX_INTENTOS = 5;
const BLOQUEO_MIN  = 15;
let codigoGenerado = null;
let userPendiente  = null;

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
                uid:              credencial.user.uid,
                email:            correo,
                rol:              rolSeleccionado,
                perfilCompleto:   false,
                reputacion:       5,
                totalValores:     0,
                intentosFallidos: 0,
                bloqueadoHasta:   null
            });
            await redireccionarUsuario(credencial.user);
        } catch (error) {
            mostrarError(traducirError(error.code));
            btn.innerText = "Registrarse";
            btn.disabled  = false;
        }

    } else {
        btn.innerText = "Verificando...";
        btn.disabled  = true;

        // ── 1. Verificar bloqueo ──
        const bloqueado = await verificarBloqueo(correo);
        if (bloqueado) {
            btn.innerText = "Iniciar Sesión";
            btn.disabled  = false;
            return;
        }

        try {
            sessionStorage.setItem('esperando2FA', '1');
            const credencial = await signInWithEmailAndPassword(auth, correo, pass);

            // ── 2. Login exitoso: resetear intentos + guardar log ──
            const key = correo.replace(/\./g, '_').replace(/@/g, '__');
            await setDoc(doc(db, "seguridad", key), {
                intentos: 0, bloqueadoHasta: null, email: correo
            });
            await guardarLog(credencial.user.uid, correo, "exitoso");

            // ── 3. Iniciar 2FA ──
            await iniciar2FA(credencial.user, correo);

        } catch (error) {
            sessionStorage.removeItem('esperando2FA');
            await registrarIntentoFallido(correo, error.code);
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
    if (!docSnap.exists()) { window.location.href = "perfil.html"; return; }
    const data = docSnap.data();
    // Redirigir según rol
    if (data.rol === "Admin")      { window.location.href = "admin.html";      return; }
    if (data.rol === "Moderador")  { window.location.href = "moderador.html";  return; }
    if (data.perfilCompleto)       { window.location.href = "dashboard.html";  return; }
    window.location.href = "perfil.html";
}

// ─── VERIFICAR BLOQUEO ────────────────────────────────────────────────────
async function verificarBloqueo(correo) {
    try {
        const key  = correo.replace(/\./g, '_').replace(/@/g, '__');
        const snap = await getDoc(doc(db, "seguridad", key));
        if (!snap.exists()) return false;
        const data = snap.data();
        if (!data.bloqueadoHasta) return false;
        const hasta = new Date(data.bloqueadoHasta);
        if (new Date() < hasta) {
            const min = Math.ceil((hasta - new Date()) / 60000);
            mostrarError(`⛔ Cuenta bloqueada. Intenta de nuevo en ${min} minuto${min !== 1 ? 's' : ''}.`);
            return true;
        }
        return false;
    } catch (e) { return false; }
}

// ─── REGISTRAR INTENTO FALLIDO ────────────────────────────────────────────
async function registrarIntentoFallido(correo) {
    try {
        const key  = correo.replace(/\./g, '_').replace(/@/g, '__');
        const ref2 = doc(db, "seguridad", key);
        const snap = await getDoc(ref2);
        const data = snap.exists() ? snap.data() : { intentos: 0 };
        const nuevos = (data.intentos || 0) + 1;

        if (nuevos >= MAX_INTENTOS) {
            const hasta = new Date(Date.now() + BLOQUEO_MIN * 60000).toISOString();
            await setDoc(ref2, { intentos: nuevos, bloqueadoHasta: hasta, email: correo });
            mostrarError(`⛔ Demasiados intentos. Cuenta bloqueada por ${BLOQUEO_MIN} minutos.`);
        } else {
            await setDoc(ref2, { intentos: nuevos, bloqueadoHasta: null, email: correo });
            const restantes = MAX_INTENTOS - nuevos;
            if (restantes <= 2) {
                mostrarError(`Correo o contraseña incorrectos. Te quedan ${restantes} intento${restantes !== 1 ? 's' : ''}.`);
            }
        }
    } catch (e) { console.warn("Error registrando intento:", e); }
}

// ─── GUARDAR LOG DE ACCESO ────────────────────────────────────────────────
async function guardarLog(uid, correo, estado) {
    try {
        await addDoc(collection(db, "logsAcceso"), {
            uid,
            email:      correo,
            estado,
            fecha:      new Date().toISOString(),
            navegador:  navigator.userAgent.substring(0, 150),
            plataforma: navigator.platform || "Desconocido"
        });
    } catch (e) { console.warn("Error guardando log:", e); }
}

// ─── 2FA: GENERAR Y GUARDAR CÓDIGO EN FIRESTORE ───────────────────────────
async function iniciar2FA(user, correo) {
    userPendiente  = user;
    codigoGenerado = Math.floor(100000 + Math.random() * 900000).toString();
    const expira   = new Date(Date.now() + 5 * 60000).toISOString();

    // Borrar documento anterior si existe (para forzar onCreate en Cloud Function)
    try { await deleteDoc(doc(db, "codigos2FA", user.uid)); } catch(e) {}
    // Esperar un momento para asegurar que el delete se procese
    await new Promise(r => setTimeout(r, 500));
    // Crear nuevo documento → dispara onCodigo2FA Cloud Function
    await setDoc(doc(db, "codigos2FA", user.uid), {
        codigo:   codigoGenerado,
        email:    correo,
        expira,
        usado:    false,
        creadoEn: new Date().toISOString()
    });

    // Mostrar pantalla de verificación
    document.getElementById('formLogin').style.display = 'none';
    document.getElementById('form2FA').style.display   = 'block';
    document.getElementById('correo2FA').innerText     = correo;

    // Expirar localmente en 5 min
    setTimeout(() => { codigoGenerado = null; }, 5 * 60000);
}

// ─── VERIFICAR CÓDIGO 2FA ────────────────────────────────────────────────
document.getElementById('btnVerificar2FA').onclick = async () => {
    const inputCodigo = document.getElementById('codigo2FA').value.trim();
    const btn         = document.getElementById('btnVerificar2FA');

    if (!inputCodigo) return mostrarError("Escribe el código de verificación.");

    if (!codigoGenerado) return mostrarError("El código expiró. Inicia sesión de nuevo.");

    if (inputCodigo !== codigoGenerado) {
        return mostrarError("Código incorrecto. Verifica tu correo.");
    }

    btn.innerText = "Verificando...";
    btn.disabled  = true;

    // Marcar como usado en Firestore
    try {
        await updateDoc(doc(db, "codigos2FA", userPendiente.uid), { usado: true });
    } catch (e) {}

    codigoGenerado = null;
    sessionStorage.removeItem('esperando2FA');
    await redireccionarUsuario(userPendiente);
};

document.getElementById('btnReenviar2FA').onclick = async () => {
    if (!userPendiente) return;
    await iniciar2FA(userPendiente, userPendiente.email);
    mostrarError("✅ Código reenviado. Revisa tu correo.");
};