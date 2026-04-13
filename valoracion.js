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
    const esEmpresa  = rolActual === 'Empresa';
    const esProgram  = rolActual === 'Programador';

    // Estados de completado
    const completadoEmpresa      = !!postulacionData.completadoEmpresa;
    const completadoProgramador  = !!postulacionData.completadoProgramador;
    const ambosCompletaron       = completadoEmpresa && completadoProgramador;

    // Si ambos ya confirmaron → activar tab y valoraciones
    if (ambosCompletaron) {
        const tabValorar = document.getElementById('tabValorar');
        if (tabValorar) tabValorar.style.display = 'block';
        renderizarTabValorar(db, postulacionId, postulacionData, proyectoData, usuarioActual, rolActual);
    }

    // Renderizar panel de completar en el chat
    renderizarPanelCompletar(db, postulacionId, postulacionData, usuarioActual,
        esEmpresa, esProgram, completadoEmpresa, completadoProgramador, ambosCompletaron);
}

// ─── PANEL COMPLETAR ──────────────────────────────────────────────────────
function renderizarPanelCompletar(db, postulacionId, postulacionData, usuarioActual,
    esEmpresa, esProgram, completadoEmpresa, completadoProgramador, ambosCompletaron) {

    const panel = document.getElementById('panelCompletar');
    if (!panel) return;

    panel.style.display = 'block';
    panel.innerHTML = '';

    if (ambosCompletaron) {
        // Ambos confirmaron
        panel.innerHTML = `
            <div class="completar-box completado">
                <span>🎉</span>
                <div>
                    <strong>¡Proyecto completado!</strong>
                    <p>Ambas partes confirmaron la finalización. Ve al tab <strong>⭐ Valorar</strong> para calificar la experiencia.</p>
                </div>
            </div>`;
        return;
    }

    // Determinar si YO ya confirmé
    const yoConfirme = esEmpresa ? completadoEmpresa : completadoProgramador;
    const otroConfirmo = esEmpresa ? completadoProgramador : completadoEmpresa;
    const otroRol = esEmpresa ? 'El programador' : 'La empresa';

    if (yoConfirme && !otroConfirmo) {
        // Yo ya confirmé, esperando al otro
        panel.innerHTML = `
            <div class="completar-box esperando">
                <span>⏳</span>
                <div>
                    <strong>Esperando confirmación</strong>
                    <p>${otroRol} aún no ha confirmado que el proyecto está completado.</p>
                </div>
            </div>`;
        return;
    }

    if (!yoConfirme && otroConfirmo) {
        // El otro ya confirmó, me toca a mí
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
                <p>Cuando ambas partes confirmen, se habilitará el sistema de valoraciones.</p>
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
    const campo = esEmpresa ? 'completadoEmpresa' : 'completadoProgramador';
    const otroCampo = esEmpresa ? 'completadoProgramador' : 'completadoEmpresa';
    const otroId = esEmpresa ? postulacionData.programadorId : postulacionData.empresaId;

    try {
        const update = { [campo]: true };

        // Verificar si el otro ya confirmó para marcar completado total
        const postuSnap = await getDoc(doc(db, "postulaciones", postulacionId));
        const postuData = postuSnap.data();

        if (postuData[otroCampo]) {
            // El otro ya confirmó → ambos completaron
            update.estadoProyecto  = 'completado';
            update.fechaCompletado = new Date().toISOString();

            // FIX: actualizar el documento del proyecto para que salga del dashboard
            await updateDoc(doc(db, "proyectos", postulacionData.proyectoId), {
                estado: 'finalizado'
            });
        }

        await updateDoc(doc(db, "postulaciones", postulacionId), update);

        // Notificar a la otra parte
        const mensaje = postuData[otroCampo]
            ? `¡El proyecto "${postulacionData.proyectoTitulo}" ha sido completado por ambas partes! Ya pueden valorarse.`
            : `${esEmpresa ? 'La empresa' : 'El programador'} marcó el proyecto "${postulacionData.proyectoTitulo}" como completado. ¡Confirma para activar las valoraciones!`;

        await addDoc(collection(db, "notificaciones"), {
            para:    otroId,
            mensaje,
            fecha:   new Date().toISOString(),
            leido:   false
        });

        // Correo de proyecto completado → manejado por Cloud Function onProyectoCompletado

        window.location.reload();

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

    const miValSnap = await getDoc(doc(db, "valoraciones", miValoracionId));
    const suValSnap = await getDoc(doc(db, "valoraciones", suValoracionId));

    const miValoracion = miValSnap.exists() ? miValSnap.data() : null;
    const suValoracion = suValSnap.exists() ? suValSnap.data() : null;

    const etiquetas = esEmpresa
        ? ETIQUETAS_EMPRESA_A_PROGRAMADOR
        : ETIQUETAS_PROGRAMADOR_A_EMPRESA;

    const nombreValuado = esEmpresa
        ? postulacionData.nombreProgramador
        : (proyectoData?.empresaNombre || 'la empresa');

    cont.innerHTML = '';

    // Banner completado
    const banner = document.createElement('div');
    banner.className = 'proyecto-completado-banner';
    banner.innerHTML = `
        <span class="banner-icon">🎉</span>
        <h3>¡Proyecto completado!</h3>
        <p>Valora tu experiencia con ${nombreValuado}</p>`;
    cont.appendChild(banner);

    if (miValoracion) {
        // Ya valoré
        const yaVal = document.createElement('div');
        yaVal.className = 'ya-valorado';
        yaVal.innerHTML = `
            <span>✅</span>
            <h3>Ya enviaste tu valoración</h3>
            <p>Gracias por tu retroalimentación.</p>`;
        cont.appendChild(yaVal);
    } else {
        // Mostrar formulario
        cont.appendChild(crearFormulario(
            db, postulacionId, postulacionData,
            usuarioActual, rolActual, miValoracionId,
            etiquetas, nombreValuado
        ));
    }

    // Mostrar valoración recibida si ya la enviaron
    if (suValoracion) {
        const recibida = document.createElement('div');
        recibida.className = 'valoracion-recibida';
        const estrellas = '⭐'.repeat(suValoracion.estrellas) + '☆'.repeat(5 - suValoracion.estrellas);
        const etiquetasHTML = (suValoracion.etiquetas || [])
            .map(e => `<span class="val-etiqueta ${e.tipo}">${e.texto}</span>`).join('');
        recibida.innerHTML = `
            <h4>⭐ Valoración que recibiste</h4>
            <div class="val-estrellas">${estrellas} (${suValoracion.estrellas}/5)</div>
            ${etiquetasHTML ? `<div class="val-etiquetas">${etiquetasHTML}</div>` : ''}
            ${suValoracion.comentario
                ? `<div class="val-comentario">"${suValoracion.comentario}"</div>`
                : ''}`;
        cont.appendChild(recibida);
    }
}

// ─── FORMULARIO DE VALORACIÓN ─────────────────────────────────────────────
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

        <button class="btn-enviar-valoracion" id="btnEnviarVal" disabled>
            Enviar valoración
        </button>`;

    // Estrellas
    const stars = form.querySelectorAll('.star-btn');
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
            if (idx >= 0) {
                etiquetasSeleccionadas.splice(idx, 1);
                chip.classList.remove('selected');
            } else {
                etiquetasSeleccionadas.push({ texto, tipo });
                chip.classList.add('selected');
            }
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

            await setDoc(doc(db, "valoraciones", valoracionId), {
                postulacionId,
                proyectoId:  postulacionData.proyectoId,
                autorId:     usuarioActual.uid,
                autorRol:    rolActual,
                valuadoId:   esEmpresa ? postulacionData.programadorId : postulacionData.empresaId,
                estrellas:   estrellaSeleccionada,
                etiquetas:   etiquetasSeleccionadas,
                comentario,
                fecha:       new Date().toISOString()
            });

            await actualizarReputacion(
                db,
                esEmpresa ? postulacionData.programadorId : postulacionData.empresaId,
                estrellaSeleccionada
            );

            await addDoc(collection(db, "notificaciones"), {
                para:    esEmpresa ? postulacionData.programadorId : postulacionData.empresaId,
                mensaje: `Recibiste una valoración de ${estrellaSeleccionada} ⭐ por el proyecto "${postulacionData.proyectoTitulo}".`,
                fecha:   new Date().toISOString(),
                leido:   false
            });

            // Correo de valoración recibida al valuado
            const valuadoId2 = esEmpresa ? postulacionData.programadorId : postulacionData.empresaId;
            const valSnap2   = await getDoc(doc(db, "usuarios", valuadoId2));
            if (valSnap2.exists() && valSnap2.data().email) {
                try {
                    await emailjs.send("service_sq5han5", "template_kdb93sl", {
                        nombre:   valSnap2.data().nombre || "Usuario",
                        to_email: valSnap2.data().email,
                        asunto:   `Recibiste una valoración de ${estrellaSeleccionada} ⭐ en "${postulacionData.proyectoTitulo}"`,
                        mensaje:  `Alguien dejó una valoración de ${estrellaSeleccionada} estrellas sobre tu desempeño en el proyecto "${postulacionData.proyectoTitulo}". Ingresa a Jobify para verla.`
                    });
                    console.log("✅ Correo valoración enviado al valuado");
                } catch(e) { console.error("❌ Error correo valoración valuado:", e); }
            }
            // Correo también al que envió la valoración (confirmación)
            const autorSnap = await getDoc(doc(db, "usuarios", user.uid));
            if (autorSnap.exists() && autorSnap.data().email) {
                try {
                    await emailjs.send("service_sq5han5", "template_kdb93sl", {
                        nombre:   autorSnap.data().nombre || "Usuario",
                        to_email: autorSnap.data().email,
                        asunto:   `Tu valoración en "${postulacionData.proyectoTitulo}" fue enviada`,
                        mensaje:  `Tu valoración de ${estrellaSeleccionada} estrellas para el proyecto "${postulacionData.proyectoTitulo}" fue enviada exitosamente. ¡Gracias por tu retroalimentación!`
                    });
                    console.log("✅ Correo confirmación enviado al autor");
                } catch(e) { console.error("❌ Error correo confirmación:", e); }
            }

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
        const userData     = userSnap.data();
        const repActual    = userData.reputacion   || 5;
        const totalValores = userData.totalValores || 0;
        const nuevoTotal   = totalValores + 1;
        const nuevoPromedio = ((repActual * totalValores) + nuevaEstrellas) / nuevoTotal;
        await updateDoc(userRef, {
            reputacion:   Math.round(nuevoPromedio * 10) / 10,
            totalValores: nuevoTotal
        });
    } catch (e) { console.error("Error actualizando reputación:", e); }
}