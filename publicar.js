import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAReLeJ4fIMhjmTQMy6fgOpkEn9ebspjTU",
    authDomain: "jobify-392f2.firebaseapp.com",
    projectId: "jobify-392f2",
    storageBucket: "jobify-392f2.firebasestorage.app",
    messagingSenderId: "508357161570",
    appId: "1:508357161570:web:3137bb4e917e2e0552173b"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ─── CONTROL DE SESIÓN ───────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = "index.html"; return; }

    const userSnap = await getDoc(doc(db, "usuarios", user.uid));
    if (!userSnap.exists()) { window.location.href = "index.html"; return; }

    const userData = userSnap.data();

    // Solo empresas pueden publicar
    if (userData.rol !== "Empresa") {
        alert("Solo las empresas pueden publicar proyectos.");
        window.location.href = "dashboard.html";
        return;
    }

    // Badge de rol
    const badge = document.getElementById('roleBadge');
    if (badge) {
        badge.innerText = userData.rol;
        badge.className = 'role-badge emp';
    }
});

// ─── CONTADOR DE PALABRAS ────────────────────────────────────────────────
const descTextarea  = document.getElementById('projDesc');
const wordCountEl   = document.getElementById('wordCount');
const MAX_PALABRAS  = 1500;

descTextarea.addEventListener('input', () => {
    const palabras = descTextarea.value.trim() === ''
        ? 0
        : descTextarea.value.trim().split(/\s+/).length;
    wordCountEl.innerText = palabras;
    const counter = wordCountEl.parentElement;
    if (palabras > MAX_PALABRAS) {
        counter.classList.add('over');
    } else {
        counter.classList.remove('over');
    }
});

// ─── PRESUPUESTO PERSONALIZADO ───────────────────────────────────────────
document.querySelectorAll('input[name="presupuestoRango"]').forEach(radio => {
    radio.addEventListener('change', () => {
        const custom = document.getElementById('presupuestoPersonalizado');
        custom.style.display = radio.value === 'personalizado' ? 'block' : 'none';
    });
});

// ─── VALIDACIÓN Y PUBLICAR ───────────────────────────────────────────────
document.getElementById('btnPublish').addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) { alert("Sesión expirada. Por favor inicia sesión de nuevo."); return; }

    // Recolectar valores
    const titulo       = document.getElementById('projTitle').value.trim();
    const descripcion  = document.getElementById('projDesc').value.trim();
    const categoria    = document.getElementById('projCategoria').value;
    const duracion     = parseInt(document.getElementById('projDuration').value);
    const entrega      = document.getElementById('projEntrega').value;
    const pago         = document.getElementById('projPago').value;

    const nivelEl      = document.querySelector('input[name="nivel"]:checked');
    const nivel        = nivelEl ? nivelEl.value : '';

    const tags         = Array.from(document.querySelectorAll('.tag-check:checked')).map(c => c.value);
    const tipoProyecto = Array.from(document.querySelectorAll('.tipo-check:checked')).map(c => c.value);

    const presupuestoRangoEl = document.querySelector('input[name="presupuestoRango"]:checked');
    const presupuestoRango   = presupuestoRangoEl ? presupuestoRangoEl.value : '';
    let presupuesto = 0;
    if (presupuestoRango === 'personalizado') {
        presupuesto = parseInt(document.getElementById('projBudgetCustom').value) || 0;
    } else {
        presupuesto = parseInt(presupuestoRango) || 0;
    }

    // ── Validaciones ──
    const errores = [];

    if (!titulo)                      errores.push("El título es obligatorio.");
    if (titulo.length < 5)            errores.push("El título debe tener al menos 5 caracteres.");
    if (!descripcion)                 errores.push("La descripción es obligatoria.");

    const palabras = descripcion.trim().split(/\s+/).length;
    if (palabras > MAX_PALABRAS)      errores.push(`La descripción excede el límite de ${MAX_PALABRAS} palabras.`);
    if (palabras < 10)                errores.push("La descripción debe tener al menos 10 palabras.");

    if (!categoria)                   errores.push("Selecciona una categoría.");
    if (tipoProyecto.length === 0)    errores.push("Selecciona al menos un tipo de proyecto.");
    if (tags.length === 0)            errores.push("Selecciona al menos una tecnología.");
    if (!nivel)                       errores.push("Selecciona el nivel de experiencia requerido.");
    if (!duracion || duracion < 1)    errores.push("La duración debe ser al menos 1 semana.");
    if (duracion > 12)                errores.push("La duración máxima es 12 semanas.");
    if (!entrega)                     errores.push("Selecciona la modalidad de revisión.");
    if (!presupuestoRango)            errores.push("Selecciona un rango de presupuesto.");
    if (presupuesto <= 0)             errores.push("El presupuesto debe ser mayor a 0.");
    if (!pago)                        errores.push("Selecciona la modalidad de pago.");

    // Mostrar errores
    const errorEl = document.getElementById('formError');
    if (errores.length > 0) {
        errorEl.style.display = 'block';
        errorEl.innerHTML = '⚠️ Por favor corrige lo siguiente:<br>' +
            errores.map(e => `• ${e}`).join('<br>');
        errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }

    errorEl.style.display = 'none';

    // ── Publicar ──
    const btn = document.getElementById('btnPublish');
    btn.innerText  = 'Publicando...';
    btn.disabled   = true;

    try {
        await addDoc(collection(db, "proyectos"), {
            titulo,
            descripcion,
            categoria,
            tipoProyecto,
            tags,
            nivel,
            duracionSemanas:  duracion,
            modalidadEntrega: entrega,
            modalidadPago:    pago,
            presupuesto:      presupuesto,
            empresaId:        user.uid,
            estado:           "activo",
            fechaPublicacion: new Date().toISOString()
        });

        alert("¡Proyecto publicado con éxito!");
        window.location.href = "dashboard.html";

    } catch (error) {
        errorEl.style.display = 'block';
        errorEl.innerText     = "Error al publicar: " + error.message;
        btn.innerText  = '🚀 Publicar Proyecto';
        btn.disabled   = false;
    }
});