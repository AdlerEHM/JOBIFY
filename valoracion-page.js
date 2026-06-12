import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, addDoc }
    from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
const db   = getFirestore(app);

const urlParams     = new URLSearchParams(window.location.search);
const postulacionId = urlParams.get('postulacionId');

if (!postulacionId) {
    alert("Valoración no encontrada.");
    window.location.href = "misproyectos.html";
}

// ─── ETIQUETAS ────────────────────────────────────────────────────────────
const ETIQUETAS = {
    empresa: {
        positivas: [
            "Cumplió tiempos", "Código limpio", "Buena comunicación",
            "Alta proactividad", "Resuelve problemas rápidamente",
            "Buena documentación", "Flexibilidad ante cambios",
            "Buena gestión del tiempo", "Entregas parciales claras",
            "Buena presentación del proyecto final"
        ],
        negativas: [
            "Incumplimiento de tiempos", "Código desorganizado o con errores",
            "Poca o nula comunicación", "Falta de iniciativa",
            "Dificultad para resolver problemas", "Documentación incompleta",
            "Resistencia a cambios", "Mala gestión del tiempo",
            "Entregas incompletas o confusas", "Presentación final deficiente"
        ]
    },
    programador: {
        positivas: [
            "Cumplió con tiempos", "Buena comunicación", "Alta proactividad",
            "Flexibilidad ante cambios", "Claridad en los requerimientos",
            "Buen tiempo de respuesta en el chat", "Evaluación justa y coherente",
            "Respeto al cronograma de pagos"
        ],
        negativas: [
            "Incumplimiento de plazos", "Comunicación deficiente o ambigua",
            "Falta de iniciativa para coordinar", "Rigidez ante sugerencias",
            "Requerimientos poco claros o cambiantes", "Demoras constantes en el chat",
            "Evaluación subjetiva o incoherente", "Retrasos en los pagos"
        ]
    }
};

const DESCRIPCIONES_ESTRELLAS = {
    1: "Muy malo — experiencia muy negativa",
    2: "Malo — varios problemas",
    3: "Regular — aceptable pero mejorable",
    4: "Bueno — experiencia positiva",
    5: "Excelente — superó expectativas"
};

// ─── INICIO ───────────────────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = "index.html"; return; }

    // Cargar postulación
    const postuSnap = await getDoc(doc(db, "postulaciones", postulacionId));
    if (!postuSnap.exists()) {
        alert("Postulación no encontrada.");
        window.location.href = "misproyectos.html";
        return;
    }
    const postulacionData = postuSnap.data();

    // Verificar acceso
    if (user.uid !== postulacionData.empresaId && user.uid !== postulacionData.programadorId) {
        alert("No tienes acceso a esta valoración.");
        window.location.href = "misproyectos.html";
        return;
    }

    // Verificar que el proyecto esté completado
    if (postulacionData.estadoProyecto !== 'completado') {
        alert("El proyecto aún no ha sido completado por ambas partes.");
        window.location.href = "misproyectos.html";
        return;
    }

    // Cargar proyecto
    const proySnap = await getDoc(doc(db, "proyectos", postulacionData.proyectoId));
    const proyectoData = proySnap.exists() ? proySnap.data() : {};

    // Cargar nombre de empresa si falta
    if (!proyectoData.empresaNombre) {
        const empSnap = await getDoc(doc(db, "usuarios", postulacionData.empresaId));
        if (empSnap.exists()) proyectoData.empresaNombre = empSnap.data().nombre;
    }

    // Datos del usuario
    const userSnap = await getDoc(doc(db, "usuarios", user.uid));
    const userData  = userSnap.data();
    const rolActual = userData.rol;
    const esEmpresa = rolActual === 'Empresa';

    // Badge
    const badge = document.getElementById('roleBadge');
    badge.innerText = rolActual;
    badge.className = 'role-badge ' + (esEmpresa ? 'emp' : 'prog');

    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('mainContent').style.display  = 'block';

    // IDs de valoración
    const miValoracionId = `${postulacionId}_${esEmpresa ? 'empresa' : 'programador'}`;
    const suValoracionId = `${postulacionId}_${esEmpresa ? 'programador' : 'empresa'}`;

    const miValSnap = await getDoc(doc(db, "valoraciones", miValoracionId));
    const suValSnap = await getDoc(doc(db, "valoraciones", suValoracionId));

    const miValoracion = miValSnap.exists() ? miValSnap.data() : null;
    const suValoracion = suValSnap.exists() ? suValSnap.data() : null;

    const etiquetas     = esEmpresa ? ETIQUETAS.empresa : ETIQUETAS.programador;
    const nombreValuado = esEmpresa
        ? postulacionData.nombreProgramador
        : (proyectoData.empresaNombre || 'la empresa');

    const cont = document.getElementById('valorarContenido');
    cont.innerHTML = '';

    // Banner
    const banner = document.createElement('div');
    banner.className = 'proyecto-completado-banner';
    banner.innerHTML = `
        <span class="banner-icon">🎉</span>
        <h3>¡Proyecto completado!</h3>
        <p>${postulacionData.proyectoTitulo || proyectoData.titulo || 'Proyecto'}</p>`;
    cont.appendChild(banner);

    if (miValoracion) {
        // Ya valoré — mostrar mensaje
        const yaVal = document.createElement('div');
        yaVal.className = 'ya-valorado';
        yaVal.innerHTML = `
            <span>✅</span>
            <h3>Ya enviaste tu valoración</h3>
            <p>Gracias por tu retroalimentación. Esto ayuda a construir una comunidad de confianza en Jobify.</p>
            <button onclick="window.location.href='misproyectos.html'"
                style="margin-top:16px; padding:10px 24px; background:var(--primary); color:white;
                       border:none; border-radius:8px; font-weight:600; font-size:14px; cursor:pointer;">
                ← Volver a Mis Proyectos
            </button>`;
        cont.appendChild(yaVal);
    } else {
        // Mostrar formulario
        cont.appendChild(
            crearFormulario(db, postulacionId, postulacionData, user, rolActual, miValoracionId, etiquetas, nombreValuado)
        );
    }

    // Mostrar valoración recibida si ya la enviaron
    if (suValoracion) {
        const recibida = document.createElement('div');
        recibida.className = 'valoracion-recibida';
        const estrellas    = '⭐'.repeat(suValoracion.estrellas) + '☆'.repeat(5 - suValoracion.estrellas);
        const etiquetasHTML = (suValoracion.etiquetas || [])
            .map(e => `<span class="val-etiqueta ${e.tipo}">${e.texto}</span>`).join('');
        recibida.innerHTML = `
            <h4>⭐ Valoración que recibiste</h4>
            <div class="val-estrellas">${estrellas} (${suValoracion.estrellas}/5)</div>
            ${etiquetasHTML ? `<div class="val-etiquetas">${etiquetasHTML}</div>` : ''}
            ${suValoracion.comentario
                ? `<div class="val-comentario">"${suValoracion.comentario}"</div>`
                : '<p style="font-size:13px;color:#aaa;">Sin comentario.</p>'}`;
        cont.appendChild(recibida);
    }
});

// ─── FORMULARIO ───────────────────────────────────────────────────────────
function crearFormulario(db, postulacionId, postulacionData, user, rolActual, valoracionId, etiquetas, nombreValuado) {
    const form = document.createElement('div');
    form.className = 'valoracion-form';

    let estrellaSeleccionada = 0;
    const etiquetasSeleccionadas = [];

    form.innerHTML = `
        <h3>Valora a ${nombreValuado}</h3>
        <p class="valoracion-subtitle">Tu opinión es importante y ayuda a otros usuarios a tomar mejores decisiones.</p>

        <div class="stars-section">
            <span class="stars-label">Calificación general</span>
            <div class="stars-container">
                ${[1,2,3,4,5].map(n => `<button class="star-btn" data-valor="${n}">⭐</button>`).join('')}
            </div>
            <div class="stars-desc" id="starsDesc">Selecciona una calificación</div>
        </div>

        <div class="etiquetas-section">
            <span class="etiquetas-label">Etiquetas (selecciona las que apliquen)</span>
            <div class="etiquetas-grupo">
                <div class="etiquetas-grupo-titulo">👍 Positivas</div>
                <div class="etiquetas-cloud">
                    ${etiquetas.positivas.map(e =>
                        `<span class="etiqueta-chip positiva" data-texto="${e}" data-tipo="positiva">${e}</span>`
                    ).join('')}
                </div>
            </div>
            <div class="etiquetas-grupo">
                <div class="etiquetas-grupo-titulo">👎 Negativas</div>
                <div class="etiquetas-cloud">
                    ${etiquetas.negativas.map(e =>
                        `<span class="etiqueta-chip negativa" data-texto="${e}" data-tipo="negativa">${e}</span>`
                    ).join('')}
                </div>
            </div>
        </div>

        <div class="comentario-section">
            <span class="comentario-label">Comentario público (opcional)</span>
            <textarea id="comentarioVal" rows="4"
                placeholder="Comparte tu experiencia trabajando con ${nombreValuado}..."></textarea>
        </div>

        <button class="btn-enviar-valoracion" id="btnEnviarVal" disabled>
            Enviar valoración
        </button>`;

    // Lógica estrellas
    const stars     = form.querySelectorAll('.star-btn');
    const starsDesc = form.querySelector('#starsDesc');

    stars.forEach(btn => {
        btn.addEventListener('click', () => {
            estrellaSeleccionada = parseInt(btn.getAttribute('data-valor'));
            stars.forEach((s, i) => s.classList.toggle('active', i < estrellaSeleccionada));
            starsDesc.innerText = DESCRIPCIONES_ESTRELLAS[estrellaSeleccionada] || '';
            form.querySelector('#btnEnviarVal').disabled = false;
        });
        btn.addEventListener('mouseenter', () => {
            starsDesc.innerText = DESCRIPCIONES_ESTRELLAS[parseInt(btn.getAttribute('data-valor'))] || '';
        });
        btn.addEventListener('mouseleave', () => {
            starsDesc.innerText = estrellaSeleccionada
                ? DESCRIPCIONES_ESTRELLAS[estrellaSeleccionada]
                : 'Selecciona una calificación';
        });
    });

    // Lógica etiquetas
    form.querySelectorAll('.etiqueta-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const texto = chip.getAttribute('data-texto');
            const tipo  = chip.getAttribute('data-tipo');
            const idx   = etiquetasSeleccionadas.findIndex(e => e.texto === texto);
            if (idx >= 0) { etiquetasSeleccionadas.splice(idx, 1); chip.classList.remove('selected'); }
            else          { etiquetasSeleccionadas.push({ texto, tipo }); chip.classList.add('selected'); }
        });
    });

    // Enviar valoración
    form.querySelector('#btnEnviarVal').addEventListener('click', async () => {
        if (!estrellaSeleccionada) return alert("Selecciona una calificación con estrellas.");
        const btn = form.querySelector('#btnEnviarVal');
        btn.innerText = 'Enviando...';
        btn.disabled  = true;

        try {
            const esEmpresa  = rolActual === 'Empresa';
            const comentario = form.querySelector('#comentarioVal').value.trim();
            const valuadoId  = esEmpresa ? postulacionData.programadorId : postulacionData.empresaId;

            // Guardar valoración
            await setDoc(doc(db, "valoraciones", valoracionId), {
                postulacionId,
                proyectoId:  postulacionData.proyectoId,
                autorId:     user.uid,
                autorRol:    rolActual,
                valuadoId,
                estrellas:   estrellaSeleccionada,
                etiquetas:   etiquetasSeleccionadas,
                comentario,
                fecha:       new Date().toISOString()
            });

            // Actualizar reputación
            const userRef  = doc(db, "usuarios", valuadoId);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                const ud            = userSnap.data();
                const repActual     = ud.reputacion   || 5;
                const totalValores  = ud.totalValores || 0;
                const nuevoTotal    = totalValores + 1;
                const nuevoPromedio = ((repActual * totalValores) + estrellaSeleccionada) / nuevoTotal;
                await updateDoc(userRef, {
                    reputacion:   Math.round(nuevoPromedio * 10) / 10,
                    totalValores: nuevoTotal
                });
            }

            // Notificación
            await addDoc(collection(db, "notificaciones"), {
                para:    valuadoId,
                mensaje: `Recibiste una valoración de ${estrellaSeleccionada} ⭐ por el proyecto "${postulacionData.proyectoTitulo}".`,
                fecha:   new Date().toISOString(),
                leido:   false
            });

            alert("¡Valoración enviada con éxito!");
            window.location.href = "misproyectos.html";

        } catch (e) {
            alert("Error al enviar: " + e.message);
            btn.innerText = 'Enviar valoración';
            btn.disabled  = false;
        }
    });

    return form;
}