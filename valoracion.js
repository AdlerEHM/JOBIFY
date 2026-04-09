import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, addDoc, onSnapshot }
    from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ─── ETIQUETAS ────────────────────────────────────────────────────────────
const ETIQUETAS_EMPRESA_A_PROGRAMADOR = {
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
};

const ETIQUETAS_PROGRAMADOR_A_EMPRESA = {
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
};

const DESCRIPCIONES_ESTRELLAS = {
    1: "Muy malo — experiencia muy negativa",
    2: "Malo — varios problemas",
    3: "Regular — aceptable pero mejorable",
    4: "Bueno — experiencia positiva",
    5: "Excelente — superó expectativas"
};

// ─── INICIAR MÓDULO ───────────────────────────────────────────────────────
export async function iniciarValoraciones(db, postulacionId, postulacionData, proyectoData, usuarioActual, rolActual) {
    const esEmpresa = rolActual === 'Empresa';

    // BUG 5 FIX: escuchar cambios en tiempo real con onSnapshot
    // para que el panel se actualice cuando la otra parte confirma
    const postuRef = doc(db, "postulaciones", postulacionId);

    onSnapshot(postuRef, (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();

        const completadoEmpresa     = !!data.completadoEmpresa;
        const completadoProgramador = !!data.completadoProgramador;
        const ambosCompletaron      = completadoEmpresa && completadoProgramador;

        // Actualizar tab Valorar
        const tabValorar = document.getElementById('tabValorar');
        if (tabValorar) tabValorar.style.display = ambosCompletaron ? 'block' : 'none';

        // Actualizar tab Finalizar badge
        const tabFinalizar = document.getElementById('tabFinalizar');
        if (tabFinalizar) {
            if (ambosCompletaron) {
                tabFinalizar.innerText = '✅ Finalizado';
            } else if ((esEmpresa && completadoEmpresa) || (!esEmpresa && completadoProgramador)) {
                tabFinalizar.innerText = '⏳ Esperando...';
            } else {
                tabFinalizar.innerText = '🏁 Finalizar';
            }
        }

        // Renderizar panel completar
        renderizarPanelCompletar(db, postulacionId, data, usuarioActual, esEmpresa,
            completadoEmpresa, completadoProgramador, ambosCompletaron);

        // Renderizar tab valorar si ya completaron
        if (ambosCompletaron) {
            renderizarTabValorar(db, postulacionId, data, proyectoData, usuarioActual, rolActual);
        }
    });
}

// ─── PANEL COMPLETAR (Tab Finalizar) ─────────────────────────────────────
function renderizarPanelCompletar(db, postulacionId, postulacionData, usuarioActual,
    esEmpresa, completadoEmpresa, completadoProgramador, ambosCompletaron) {

    const panel = document.getElementById('panelCompletar');
    if (!panel) return;

    panel.innerHTML = '';

    const yoConfirme   = esEmpresa ? completadoEmpresa : completadoProgramador;
    const otroConfirmo = esEmpresa ? completadoProgramador : completadoEmpresa;
    const otroRol      = esEmpresa ? 'El programador' : 'La empresa';

    if (ambosCompletaron) {
        panel.innerHTML = `
            <div class="completar-box completado">
                <span>🎉</span>
                <div>
                    <strong>¡Proyecto completado!</strong>
                    <p>Ambas partes confirmaron la finalización. Ve al tab <strong>⭐ Valorar</strong> para calificar la experiencia.</p>
                </div>
            </div>
            <div style="margin-top:20px; text-align:center;">
                <button class="btn-ir-valorar" onclick="document.querySelector('[data-tab=valorar]').click()">
                    ⭐ Ir a Valorar
                </button>
            </div>`;
        return;
    }

    if (yoConfirme && !otroConfirmo) {
        panel.innerHTML = `
            <div class="completar-box esperando">
                <span>⏳</span>
                <div>
                    <strong>Confirmación enviada</strong>
                    <p>${otroRol} aún no ha confirmado que el proyecto está completado. Se le notificará.</p>
                </div>
            </div>`;
        return;
    }

    if (!yoConfirme && otroConfirmo) {
        panel.innerHTML = `
            <div class="completar-box pendiente-yo">
                <span>👋</span>
                <div>
                    <strong>${otroRol} marcó el proyecto como completado</strong>
                    <p>¿Confirmas que el proyecto ha finalizado satisfactoriamente?</p>
                </div>
                <button id="btnConfirmarCompleto" class="btn-confirmar-completo">
                    ✅ Confirmar finalización
                </button>
            </div>`;
        document.getElementById('btnConfirmarCompleto').onclick = () =>
            confirmarCompletado(db, postulacionId, postulacionData, esEmpresa, usuarioActual);
        return;
    }

    // Ninguno ha confirmado aún
    panel.innerHTML = `
        <div class="completar-box inicial">
            <span>🏁</span>
            <div>
                <strong>¿El proyecto ha finalizado?</strong>
                <p>Cuando ambas partes confirmen, se habilitará el sistema de valoraciones y el proyecto pasará al historial.</p>
            </div>
            <button id="btnProponerCompleto" class="btn-completar-proyecto">
                🎉 Marcar como completado
            </button>
        </div>`;
    document.getElementById('btnProponerCompleto').onclick = () =>
        confirmarCompletado(db, postulacionId, postulacionData, esEmpresa, usuarioActual);
}

// ─── CONFIRMAR COMPLETADO ─────────────────────────────────────────────────
async function confirmarCompletado(db, postulacionId, postulacionData, esEmpresa, usuarioActual) {
    const campo     = esEmpresa ? 'completadoEmpresa' : 'completadoProgramador';
    const otroCampo = esEmpresa ? 'completadoProgramador' : 'completadoEmpresa';
    const otroId    = esEmpresa ? postulacionData.programadorId : postulacionData.empresaId;

    try {
        const postuSnap = await getDoc(doc(db, "postulaciones", postulacionId));
        const postuData = postuSnap.data();
        const update    = { [campo]: true };

        if (postuData[otroCampo]) {
            // El otro ya confirmó → proyecto completado
            update.estadoProyecto  = 'completado';
            update.fechaCompletado = new Date().toISOString();
        }

        await updateDoc(doc(db, "postulaciones", postulacionId), update);

        const mensaje = postuData[otroCampo]
            ? `¡El proyecto "${postulacionData.proyectoTitulo}" fue completado por ambas partes! Ya pueden valorarse.`
            : `${esEmpresa ? 'La empresa' : 'El programador'} marcó el proyecto "${postulacionData.proyectoTitulo}" como completado. ¡Confirma para finalizar!`;

        await addDoc(collection(db, "notificaciones"), {
            para: otroId, mensaje,
            fecha: new Date().toISOString(), leido: false
        });

        // No recargamos — onSnapshot actualizará la UI automáticamente

    } catch (e) {
        alert("Error: " + e.message);
    }
}

// ─── RENDERIZAR TAB VALORAR ───────────────────────────────────────────────
async function renderizarTabValorar(db, postulacionId, postulacionData, proyectoData, usuarioActual, rolActual) {
    const cont = document.getElementById('valorarContenido');
    if (!cont) return;

    const esEmpresa      = rolActual === 'Empresa';
    const miValoracionId = `${postulacionId}_${esEmpresa ? 'empresa' : 'programador'}`;
    const suValoracionId = `${postulacionId}_${esEmpresa ? 'programador' : 'empresa'}`;

    const [miValSnap, suValSnap] = await Promise.all([
        getDoc(doc(db, "valoraciones", miValoracionId)),
        getDoc(doc(db, "valoraciones", suValoracionId))
    ]);

    const miValoracion = miValSnap.exists() ? miValSnap.data() : null;
    const suValoracion = suValSnap.exists() ? suValSnap.data() : null;

    // Evitar re-renderizar si ya está bien pintado
    if (cont.dataset.rendered === miValoracionId) return;
    cont.dataset.rendered = miValoracionId;
    cont.innerHTML = '';

    const etiquetas     = esEmpresa ? ETIQUETAS_EMPRESA_A_PROGRAMADOR : ETIQUETAS_PROGRAMADOR_A_EMPRESA;
    const nombreValuado = esEmpresa
        ? postulacionData.nombreProgramador
        : (proyectoData?.empresaNombre || 'la empresa');

    // Banner
    const banner = document.createElement('div');
    banner.className = 'proyecto-completado-banner';
    banner.innerHTML = `
        <span class="banner-icon">🎉</span>
        <h3>¡Proyecto completado!</h3>
        <p>Valora tu experiencia con ${nombreValuado}</p>`;
    cont.appendChild(banner);

    if (miValoracion) {
        const yaVal = document.createElement('div');
        yaVal.className = 'ya-valorado';
        yaVal.innerHTML = `
            <span>✅</span>
            <h3>Ya enviaste tu valoración</h3>
            <p>Gracias por tu retroalimentación.</p>`;
        cont.appendChild(yaVal);
    } else {
        cont.appendChild(crearFormulario(
            db, postulacionId, postulacionData,
            usuarioActual, rolActual, miValoracionId,
            etiquetas, nombreValuado
        ));
    }

    if (suValoracion) {
        const recibida = document.createElement('div');
        recibida.className = 'valoracion-recibida';
        const estrellas     = '⭐'.repeat(suValoracion.estrellas) + '☆'.repeat(5 - suValoracion.estrellas);
        const etiquetasHTML = (suValoracion.etiquetas || [])
            .map(e => `<span class="val-etiqueta ${e.tipo}">${e.texto}</span>`).join('');
        recibida.innerHTML = `
            <h4>⭐ Valoración que recibiste</h4>
            <div class="val-estrellas">${estrellas} (${suValoracion.estrellas}/5)</div>
            ${etiquetasHTML ? `<div class="val-etiquetas">${etiquetasHTML}</div>` : ''}
            ${suValoracion.comentario ? `<div class="val-comentario">"${suValoracion.comentario}"</div>` : ''}`;
        cont.appendChild(recibida);
    }
}

// ─── FORMULARIO ───────────────────────────────────────────────────────────
function crearFormulario(db, postulacionId, postulacionData, usuarioActual, rolActual, valoracionId, etiquetas, nombreValuado) {
    const form = document.createElement('div');
    form.className = 'valoracion-form';

    let estrellaSeleccionada = 0;
    const etiquetasSeleccionadas = [];

    form.innerHTML = `
        <h3>Valora a ${nombreValuado}</h3>
        <p class="valoracion-subtitle">Tu opinión ayuda a otros usuarios a tomar mejores decisiones.</p>

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

        <button class="btn-enviar-valoracion" id="btnEnviarVal" disabled>Enviar valoración</button>`;

    // Estrellas
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

    // Etiquetas
    form.querySelectorAll('.etiqueta-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const texto = chip.getAttribute('data-texto');
            const tipo  = chip.getAttribute('data-tipo');
            const idx   = etiquetasSeleccionadas.findIndex(e => e.texto === texto);
            if (idx >= 0) { etiquetasSeleccionadas.splice(idx, 1); chip.classList.remove('selected'); }
            else          { etiquetasSeleccionadas.push({ texto, tipo }); chip.classList.add('selected'); }
        });
    });

    // Enviar
    form.querySelector('#btnEnviarVal').addEventListener('click', async () => {
        if (!estrellaSeleccionada) return alert("Selecciona una calificación con estrellas.");
        const btn = form.querySelector('#btnEnviarVal');
        btn.innerText = 'Enviando...';
        btn.disabled  = true;

        try {
            const esEmpresa  = rolActual === 'Empresa';
            const comentario = form.querySelector('#comentarioVal').value.trim();
            const valuadoId  = esEmpresa ? postulacionData.programadorId : postulacionData.empresaId;

            await setDoc(doc(db, "valoraciones", valoracionId), {
                postulacionId,
                proyectoId:  postulacionData.proyectoId,
                autorId:     usuarioActual.uid,
                autorRol:    rolActual,
                valuadoId,
                estrellas:   estrellaSeleccionada,
                etiquetas:   etiquetasSeleccionadas,
                comentario,
                fecha:       new Date().toISOString()
            });

            await actualizarReputacion(db, valuadoId, estrellaSeleccionada);

            await addDoc(collection(db, "notificaciones"), {
                para:    valuadoId,
                mensaje: `Recibiste una valoración de ${estrellaSeleccionada} ⭐ por el proyecto "${postulacionData.proyectoTitulo}".`,
                fecha:   new Date().toISOString(),
                leido:   false
            });

            alert("¡Valoración enviada!");
            window.location.reload();

        } catch (e) {
            alert("Error: " + e.message);
            btn.innerText = 'Enviar valoración';
            btn.disabled  = false;
        }
    });

    return form;
}

// ─── ACTUALIZAR REPUTACIÓN ────────────────────────────────────────────────
async function actualizarReputacion(db, usuarioId, nuevaEstrellas) {
    try {
        const userRef  = doc(db, "usuarios", usuarioId);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) return;
        const ud            = userSnap.data();
        const repActual     = ud.reputacion   || 5;
        const totalValores  = ud.totalValores || 0;
        const nuevoTotal    = totalValores + 1;
        const nuevoPromedio = ((repActual * totalValores) + nuevaEstrellas) / nuevoTotal;
        await updateDoc(userRef, {
            reputacion:   Math.round(nuevoPromedio * 10) / 10,
            totalValores: nuevoTotal
        });
    } catch (e) { console.error("Error actualizando reputación:", e); }
}