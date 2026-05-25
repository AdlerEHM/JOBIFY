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
    const esEmpresa             = rolActual === 'Empresa';
    const esProgram             = rolActual === 'Programador';
    const completadoEmpresa     = !!postulacionData.completadoEmpresa;
    const completadoProgramador = !!postulacionData.completadoProgramador;
    const ambosCompletaron      = completadoEmpresa && completadoProgramador;

    if (ambosCompletaron) {
        const tabValorar = document.getElementById('tabValorar');
        if (tabValorar) tabValorar.style.display = 'block';
        renderizarTabValorar(db, postulacionId, postulacionData, proyectoData, usuarioActual, rolActual);
    }

    renderizarPanelCompletar(db, postulacionId, postulacionData, proyectoData, usuarioActual,
        esEmpresa, esProgram, completadoEmpresa, completadoProgramador, ambosCompletaron);
}

// ─── PANEL COMPLETAR ──────────────────────────────────────────────────────
function renderizarPanelCompletar(db, postulacionId, postulacionData, proyectoData, usuarioActual,
    esEmpresa, esProgram, completadoEmpresa, completadoProgramador, ambosCompletaron) {

    const panel = document.getElementById('panelCompletar');
    if (!panel) return;

    panel.style.display = 'block';
    panel.innerHTML = '';

    // Ambos completaron
    if (ambosCompletaron) {
        const pago = postulacionData.pagoRealizado ? `
            <div class="recibo-pago-box" style="margin-top:16px;">
                <div class="recibo-header">
                    <div class="recibo-check">✓</div>
                    <h3>Pago completado</h3>
                    <p>El pago fue procesado exitosamente.</p>
                </div>
                <div class="recibo-detalles">
                    <div class="recibo-fila">
                        <span>Monto</span>
                        <strong>$${postulacionData.pagoMonto?.toFixed(2) || '-'} USD</strong>
                    </div>
                    <div class="recibo-fila">
                        <span>Order ID</span>
                        <strong>${postulacionData.pagoOrderId || '-'}</strong>
                    </div>
                    <div class="recibo-fila">
                        <span>Fecha</span>
                        <strong>${postulacionData.pagoFecha
                            ? new Date(postulacionData.pagoFecha).toLocaleString('es-MX', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })
                            : '-'}</strong>
                    </div>
                    <div class="recibo-fila">
                        <span>Pagado por</span>
                        <strong>${postulacionData.pagoPayerEmail || '-'}</strong>
                    </div>
                    <div class="recibo-fila">
                        <span>Proyecto</span>
                        <strong>${postulacionData.proyectoTitulo || proyectoData?.titulo || '-'}</strong>
                    </div>
                </div>
                <p style="font-size:12px;color:#6B7280;margin:0;padding:0 24px 16px;text-align:center;">
                    Guarda el Order ID como comprobante oficial del pago.
                </p>
            </div>` : '';

        panel.innerHTML = `
            <div class="completar-box completado">
                <div>
                    <strong>Proyecto completado</strong>
                    <p>Ambas partes confirmaron la finalización. Ve a la pestaña <strong>Valorar</strong> para calificar la experiencia.</p>
                </div>
            </div>
            ${pago}`;
        return;
    }

    const yoConfirme   = esEmpresa ? completadoEmpresa : completadoProgramador;
    const otroConfirmo = esEmpresa ? completadoProgramador : completadoEmpresa;
    const otroRol      = esEmpresa ? 'El programador' : 'La empresa';

    // Yo ya confirmé, esperando al otro
    if (yoConfirme && !otroConfirmo) {
        const pagoRealizado = !!postulacionData.pagoRealizado;

        if (!esEmpresa && pagoRealizado) {
            // Programador: pago ya recibido, esperando confirmación formal
            panel.innerHTML = `
                <div class="recibo-pago-box">
                    <div class="recibo-header">
                        <div class="recibo-check">✓</div>
                        <h3>¡Pago recibido!</h3>
                        <p>La empresa realizó el pago por este proyecto.</p>
                    </div>
                    <div class="recibo-detalles">
                        <div class="recibo-fila">
                            <span>Monto recibido</span>
                            <strong>$${postulacionData.pagoMonto?.toFixed(2) || '-'} USD</strong>
                        </div>
                        <div class="recibo-fila">
                            <span>Order ID</span>
                            <strong>${postulacionData.pagoOrderId || '-'}</strong>
                        </div>
                        <div class="recibo-fila">
                            <span>Fecha</span>
                            <strong>${postulacionData.pagoFecha
                                ? new Date(postulacionData.pagoFecha).toLocaleString('es-MX', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })
                                : '-'}</strong>
                        </div>
                        <div class="recibo-fila">
                            <span>Pagado por</span>
                            <strong>${postulacionData.pagoPayerEmail || '-'}</strong>
                        </div>
                        <div class="recibo-fila">
                            <span>Proyecto</span>
                            <strong>${postulacionData.proyectoTitulo || proyectoData?.titulo || '-'}</strong>
                        </div>
                    </div>
                    <p style="font-size:12px;color:#6B7280;margin-top:12px;text-align:center;">
                        Guarda el Order ID como comprobante de pago.
                    </p>
                </div>`;
        } else if (!esEmpresa && !pagoRealizado) {
            // Programador: esperando que la empresa pague
            panel.innerHTML = `
                <div class="completar-box esperando">
                    <div>
                        <strong>⏳ Esperando pago de la empresa</strong>
                        <p>Marcaste el proyecto como completado. La empresa debe realizar el pago para finalizar oficialmente.</p>
                    </div>
                </div>`;
        } else {
            // Empresa: ya confirmó, esperando al programador
            panel.innerHTML = `
                <div class="completar-box esperando">
                    <div>
                        <strong>Esperando confirmación</strong>
                        <p>${otroRol} aún no ha confirmado que el proyecto está completado.</p>
                    </div>
                </div>`;
        }
        return;
    }

    // El otro ya confirmó, me toca a mí
    if (!yoConfirme && otroConfirmo) {
        if (esEmpresa) {
            // Empresa debe pagar antes de confirmar
            const presupuesto  = parseFloat(proyectoData?.presupuesto || 0);
            const comision     = parseFloat((presupuesto * 0.0395 + 0.22).toFixed(2));
            const totalEmpresa = parseFloat((presupuesto + comision).toFixed(2));
            const pagoRealizado = !!postulacionData.pagoRealizado;

            if (pagoRealizado) {
                panel.innerHTML = `
                    <div class="pago-completado-box">
                        <div class="pago-check">&#10003;</div>
                        <h3>Pago realizado</h3>
                        <p>El pago fue procesado. Confirma la finalización del proyecto.</p>
                        <button id="btnConfirmarCompleto" class="btn-completar-proyecto">
                            Confirmar finalización del proyecto
                        </button>
                    </div>`;
                document.getElementById('btnConfirmarCompleto').onclick = () =>
                    confirmarCompletado(db, postulacionId, postulacionData, esEmpresa, usuarioActual);
            } else {
                panel.innerHTML = `
                    <div class="finalizar-layout-wrap">
                        <div class="pago-card">
                            <h3 class="pago-titulo">El programador completó el proyecto</h3>
                            <p class="pago-subtitulo">Para finalizar realiza el pago al programador a través de PayPal.</p>
                            <div class="pago-desglose">
                                <div class="pago-fila">
                                    <span>Presupuesto acordado</span>
                                    <strong>$${presupuesto.toFixed(2)} USD</strong>
                                </div>
                                <div class="pago-fila comision">
                                    <span>Comisión Jobify (3.95% + $0.22)</span>
                                    <strong>$${comision.toFixed(2)} USD</strong>
                                </div>
                                <div class="pago-fila total">
                                    <span>Total a pagar</span>
                                    <strong>$${totalEmpresa.toFixed(2)} USD</strong>
                                </div>
                            </div>
                            <div class="pago-nota">
                                El programador recibirá <strong>$${presupuesto.toFixed(2)} USD</strong>.
                                La diferencia corresponde a la comisión de Jobify.
                            </div>
                            <div id="paypal-button-container" class="paypal-container"></div>
                            <div id="pagoEstado" class="pago-estado" style="display:none;"></div>
                        </div>
                    </div>`;

                setTimeout(() => {
                    const contenedor = document.getElementById('paypal-button-container');
                    if (!contenedor) return;
                    if (!window.paypal) {
                        contenedor.innerHTML = '<p style="color:#EF4444;font-size:13px;margin-top:8px;">Error cargando PayPal. Recarga la página.</p>';
                        return;
                    }
                    contenedor.innerHTML = '';
                    window.paypal.Buttons({
                        style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'pay', height: 45 },
                        createOrder: (data, actions) => actions.order.create({
                            purchase_units: [{
                                amount: { value: totalEmpresa.toFixed(2), currency_code: 'USD' },
                                description: `Pago proyecto: ${proyectoData?.titulo || 'Proyecto'} — Jobify`
                            }]
                        }),
                        onApprove: async (data, actions) => {
                            const estadoEl = document.getElementById('pagoEstado');
                            if (estadoEl) { estadoEl.style.display='block'; estadoEl.className='pago-estado procesando'; estadoEl.innerText='Procesando pago...'; }
                            try {
                                const details = await actions.order.capture();
                                await updateDoc(doc(db, 'postulaciones', postulacionId), {
                                    pagoRealizado:  true,
                                    pagoOrderId:    details.id,
                                    pagoMonto:      totalEmpresa,
                                    pagoCurrency:   'USD',
                                    pagoFecha:      new Date().toISOString(),
                                    pagoPayerEmail: details.payer?.email_address || ''
                                });
                                await addDoc(collection(db, 'notificaciones'), {
                                    para:    postulacionData.programadorId,
                                    mensaje: `La empresa realizó el pago de $${totalEmpresa.toFixed(2)} USD por el proyecto "${proyectoData?.titulo || 'Proyecto'}".`,
                                    fecha:   new Date().toISOString(),
                                    leido:   false
                                });
                                if (estadoEl) { estadoEl.className='pago-estado exitoso'; estadoEl.innerText='Pago realizado. Confirmando finalización...'; }
                                // Enviar correo de recibo al programador
                                try {
                                    const progSnap = await getDoc(doc(db, 'usuarios', postulacionData.programadorId));
                                    if (progSnap.exists()) {
                                        const progData = progSnap.data();
                                        if (window.emailjs && progData.email) {
                                            await emailjs.send("service_sq5han5", "template_kdb93sl", {
                                                nombre:   progData.nombre || 'Programador',
                                                to_email: progData.email,
                                                asunto:   `Recibo de pago — ${postulacionData.proyectoTitulo || proyectoData?.titulo}`,
                                                mensaje:  `La empresa realizó el pago de $${totalEmpresa.toFixed(2)} USD por el proyecto "${postulacionData.proyectoTitulo || proyectoData?.titulo}".

Detalles del pago:
• Monto: $${totalEmpresa.toFixed(2)} USD
• Order ID: ${details.id}
• Fecha: ${new Date().toLocaleString('es-MX')}
• Pagado por: ${details.payer?.email_address || '-'}

Guarda el Order ID como comprobante.`
                                            });
                                        }
                                    }
                                } catch(emailErr) { console.warn('Error enviando correo recibo:', emailErr); }
                                // Pago completado → confirmar automáticamente el proyecto
                                setTimeout(() => {
                                    confirmarCompletado(db, postulacionId, postulacionData, esEmpresa, usuarioActual);
                                }, 1500);
                            } catch(e) {
                                if (estadoEl) { estadoEl.className='pago-estado error'; estadoEl.innerText='Error al procesar el pago. Intenta de nuevo.'; }
                            }
                        },
                        onError: () => {
                            const el = document.getElementById('pagoEstado');
                            if (el) { el.style.display='block'; el.className='pago-estado error'; el.innerText='Error con PayPal. Intenta de nuevo.'; }
                        },
                        onCancel: () => {
                            const el = document.getElementById('pagoEstado');
                            if (el) { el.style.display='block'; el.className='pago-estado error'; el.innerText='Pago cancelado.'; }
                        }
                    }).render('#paypal-button-container');
                }, 300);
            }
        } else {
            // Programador: solo confirmar
            panel.innerHTML = `
                <div class="completar-box pendiente-yo">
                    <div>
                        <strong>${otroRol} marcó el proyecto como completado</strong>
                        <p>¿Confirmas que el proyecto ha finalizado satisfactoriamente?</p>
                    </div>
                    <button id="btnConfirmarCompleto" class="btn-confirmar-completo">
                        Confirmar finalización
                    </button>
                </div>`;
            document.getElementById('btnConfirmarCompleto').onclick = () =>
                confirmarCompletado(db, postulacionId, postulacionData, esEmpresa, usuarioActual);
        }
        return;
    }

    // Ninguno ha confirmado
    if (esEmpresa) {
        // Empresa: primero paga con PayPal
        const presupuesto   = parseFloat(proyectoData?.presupuesto || 0);
        const comision      = parseFloat((presupuesto * 0.0395 + 0.22).toFixed(2));
        const totalEmpresa  = parseFloat((presupuesto + comision).toFixed(2));
        const pagoRealizado = !!postulacionData.pagoRealizado;

        if (pagoRealizado) {
            panel.innerHTML = `
                <div class="pago-completado-box">
                    <div class="pago-check">&#10003;</div>
                    <h3>Pago realizado</h3>
                    <p>El pago fue procesado correctamente. Confirma que el proyecto fue completado satisfactoriamente.</p>
                    <button id="btnProponerCompleto" class="btn-completar-proyecto">
                        Confirmar finalización del proyecto
                    </button>
                </div>`;
            document.getElementById('btnProponerCompleto').onclick = () =>
                confirmarCompletado(db, postulacionId, postulacionData, esEmpresa, usuarioActual);
        } else {
            panel.innerHTML = `
                <div class="finalizar-layout-wrap">
                    <div class="pago-card">
                        <h3 class="pago-titulo">Resumen de pago</h3>
                        <p class="pago-subtitulo">Para finalizar el proyecto realiza el pago al programador a través de PayPal.</p>
                        <div class="pago-desglose">
                            <div class="pago-fila">
                                <span>Presupuesto acordado</span>
                                <strong>$${presupuesto.toFixed(2)} USD</strong>
                            </div>
                            <div class="pago-fila comision">
                                <span>Comisión Jobify (3.95% + $0.22)</span>
                                <strong>$${comision.toFixed(2)} USD</strong>
                            </div>
                            <div class="pago-fila total">
                                <span>Total a pagar</span>
                                <strong>$${totalEmpresa.toFixed(2)} USD</strong>
                            </div>
                        </div>
                        <div class="pago-nota">
                            El programador recibirá <strong>$${presupuesto.toFixed(2)} USD</strong>.
                            La diferencia corresponde a la comisión de Jobify por el servicio de intermediación.
                        </div>
                        <div id="paypal-button-container" class="paypal-container"></div>
                        <div id="pagoEstado" class="pago-estado" style="display:none;"></div>
                    </div>
                </div>`;

            // FIX: setTimeout garantiza que el div está en el DOM visible
            // antes de que PayPal intente renderizar (PayPal falla en elementos ocultos)
            setTimeout(() => {
                const contenedor = document.getElementById('paypal-button-container');
                if (!contenedor) return;

                if (!window.paypal) {
                    contenedor.innerHTML = '<p style="color:#EF4444;font-size:13px;margin-top:8px;">Error cargando PayPal. Recarga la página.</p>';
                    return;
                }

                contenedor.innerHTML = '';

                window.paypal.Buttons({
                    style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'pay', height: 45 },
                    createOrder: (data, actions) => actions.order.create({
                        purchase_units: [{
                            amount: { value: totalEmpresa.toFixed(2), currency_code: 'USD' },
                            description: `Pago proyecto: ${proyectoData?.titulo || 'Proyecto'} — Jobify`
                        }]
                    }),
                    onApprove: async (data, actions) => {
                        const estadoEl = document.getElementById('pagoEstado');
                        if (estadoEl) { estadoEl.style.display='block'; estadoEl.className='pago-estado procesando'; estadoEl.innerText='Procesando pago...'; }
                        try {
                            const details = await actions.order.capture();
                            await updateDoc(doc(db, 'postulaciones', postulacionId), {
                                pagoRealizado:  true,
                                pagoOrderId:    details.id,
                                pagoMonto:      totalEmpresa,
                                pagoCurrency:   'USD',
                                pagoFecha:      new Date().toISOString(),
                                pagoPayerEmail: details.payer?.email_address || ''
                            });
                            await addDoc(collection(db, 'notificaciones'), {
                                para:    postulacionData.programadorId,
                                mensaje: `La empresa realizó el pago de $${totalEmpresa.toFixed(2)} USD por el proyecto "${proyectoData?.titulo || 'Proyecto'}".`,
                                fecha:   new Date().toISOString(),
                                leido:   false
                            });
                            if (estadoEl) { estadoEl.className='pago-estado exitoso'; estadoEl.innerText='Pago realizado correctamente.'; }
                            setTimeout(() => {
                                postulacionData.pagoRealizado = true;
                                renderizarPanelCompletar(db, postulacionId, postulacionData, proyectoData,
                                    usuarioActual, true, false, false, false, false);
                            }, 1500);
                        } catch(e) {
                            if (estadoEl) { estadoEl.className='pago-estado error'; estadoEl.innerText='Error al procesar el pago. Intenta de nuevo.'; }
                        }
                    },
                    onError: () => {
                        const el = document.getElementById('pagoEstado');
                        if (el) { el.style.display='block'; el.className='pago-estado error'; el.innerText='Error con PayPal. Intenta de nuevo.'; }
                    },
                    onCancel: () => {
                        const el = document.getElementById('pagoEstado');
                        if (el) { el.style.display='block'; el.className='pago-estado error'; el.innerText='Pago cancelado.'; }
                    }
                }).render('#paypal-button-container');
            }, 300);
        }
    } else {
        // Programador: botón simple
        panel.innerHTML = `
            <div class="completar-box inicial">
                <div>
                    <strong>¿El proyecto ha finalizado?</strong>
                    <p>Cuando ambas partes confirmen, se habilitará el sistema de valoraciones.</p>
                </div>
                <button id="btnProponerCompleto" class="btn-completar-proyecto">
                    Marcar como completado
                </button>
            </div>`;
        document.getElementById('btnProponerCompleto').onclick = () =>
            confirmarCompletado(db, postulacionId, postulacionData, esEmpresa, usuarioActual);
    }
}

// ─── CONFIRMAR COMPLETADO ─────────────────────────────────────────────────
async function confirmarCompletado(db, postulacionId, postulacionData, esEmpresa, usuarioActual) {
    const campo     = esEmpresa ? 'completadoEmpresa' : 'completadoProgramador';
    const otroCampo = esEmpresa ? 'completadoProgramador' : 'completadoEmpresa';
    const otroId    = esEmpresa ? postulacionData.programadorId : postulacionData.empresaId;

    try {
        const update    = { [campo]: true };
        const postuSnap = await getDoc(doc(db, 'postulaciones', postulacionId));
        const postuData = postuSnap.data();

        if (postuData[otroCampo]) {
            update.estadoProyecto  = 'completado';
            update.fechaCompletado = new Date().toISOString();
            await updateDoc(doc(db, 'proyectos', postulacionData.proyectoId), { estado: 'finalizado' });
        }

        await updateDoc(doc(db, 'postulaciones', postulacionId), update);

        const mensaje = postuData[otroCampo]
            ? `El proyecto "${postulacionData.proyectoTitulo}" fue completado por ambas partes. Ya pueden valorarse.`
            : `${esEmpresa ? 'La empresa' : 'El programador'} marcó el proyecto "${postulacionData.proyectoTitulo}" como completado. Confirma para activar las valoraciones.`;

        await addDoc(collection(db, 'notificaciones'), {
            para: otroId, mensaje, fecha: new Date().toISOString(), leido: false
        });

        window.location.reload();
    } catch (e) { alert('Error: ' + e.message); }
}

// ─── TAB VALORAR ─────────────────────────────────────────────────────────
async function renderizarTabValorar(db, postulacionId, postulacionData, proyectoData, usuarioActual, rolActual) {
    const cont = document.getElementById('valorarContenido');
    if (!cont) return;

    const esEmpresa      = rolActual === 'Empresa';
    const miValoracionId = `${postulacionId}_${esEmpresa ? 'empresa' : 'programador'}`;
    const suValoracionId = `${postulacionId}_${esEmpresa ? 'programador' : 'empresa'}`;

    const miValSnap    = await getDoc(doc(db, 'valoraciones', miValoracionId));
    const suValSnap    = await getDoc(doc(db, 'valoraciones', suValoracionId));
    const miValoracion = miValSnap.exists() ? miValSnap.data() : null;
    const suValoracion = suValSnap.exists() ? suValSnap.data() : null;

    const etiquetas     = esEmpresa ? ETIQUETAS_EMPRESA_A_PROGRAMADOR : ETIQUETAS_PROGRAMADOR_A_EMPRESA;
    const nombreValuado = esEmpresa ? postulacionData.nombreProgramador : (proyectoData?.empresaNombre || 'la empresa');

    cont.innerHTML = '';

    const banner = document.createElement('div');
    banner.className = 'proyecto-completado-banner';
    banner.innerHTML = `<h3>Proyecto completado</h3><p>Valora tu experiencia con ${nombreValuado}</p>`;
    cont.appendChild(banner);

    if (miValoracion) {
        const yaVal = document.createElement('div');
        yaVal.className = 'ya-valorado';
        yaVal.innerHTML = `
            <h3>Ya enviaste tu valoración</h3>
            <p>Gracias por tu retroalimentación.</p>`;
        cont.appendChild(yaVal);
    } else {
        cont.appendChild(crearFormulario(db, postulacionId, postulacionData,
            usuarioActual, rolActual, miValoracionId, etiquetas, nombreValuado));
    }

    if (suValoracion) {
        const recibida = document.createElement('div');
        recibida.className = 'valoracion-recibida';
        const estrellas    = '★'.repeat(suValoracion.estrellas) + '☆'.repeat(5 - suValoracion.estrellas);
        const etiquetasHTML = (suValoracion.etiquetas || [])
            .map(e => `<span class="val-etiqueta ${e.tipo}">${e.texto}</span>`).join('');
        recibida.innerHTML = `
            <h4>Valoración recibida</h4>
            <div class="val-estrellas">${estrellas} (${suValoracion.estrellas}/5)</div>
            ${etiquetasHTML ? `<div class="val-etiquetas">${etiquetasHTML}</div>` : ''}
            ${suValoracion.comentario ? `<div class="val-comentario">"${suValoracion.comentario}"</div>` : ''}`;
        cont.appendChild(recibida);
    }
}

// ─── FORMULARIO ──────────────────────────────────────────────────────────
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
                ${[1,2,3,4,5].map(n => `<button class="star-btn" data-valor="${n}">&#9733;</button>`).join('')}
            </div>
            <div class="stars-desc" id="starsDesc">Selecciona una calificación</div>
        </div>
        <div class="etiquetas-section">
            <span class="etiquetas-label">Etiquetas</span>
            <div class="etiquetas-grupo">
                <div class="etiquetas-grupo-titulo">Positivas</div>
                <div class="etiquetas-cloud">
                    ${etiquetas.positivas.map(e => `<span class="etiqueta-chip positiva" data-texto="${e}" data-tipo="positiva">${e}</span>`).join('')}
                </div>
            </div>
            <div class="etiquetas-grupo">
                <div class="etiquetas-grupo-titulo">Negativas</div>
                <div class="etiquetas-cloud">
                    ${etiquetas.negativas.map(e => `<span class="etiqueta-chip negativa" data-texto="${e}" data-tipo="negativa">${e}</span>`).join('')}
                </div>
            </div>
        </div>
        <div class="comentario-section">
            <span class="comentario-label">Comentario público (opcional)</span>
            <textarea id="comentarioVal" rows="4" placeholder="Comparte tu experiencia con ${nombreValuado}..."></textarea>
        </div>
        <button class="btn-enviar-valoracion" id="btnEnviarVal" disabled>Enviar valoración</button>`;

    const stars     = form.querySelectorAll('.star-btn');
    const starsDesc = form.querySelector('#starsDesc');

    stars.forEach(btn => {
        btn.addEventListener('click', () => {
            estrellaSeleccionada = parseInt(btn.getAttribute('data-valor'));
            stars.forEach((s, i) => s.classList.toggle('active', i < estrellaSeleccionada));
            starsDesc.innerText = DESCRIPCIONES_ESTRELLAS[estrellaSeleccionada] || '';
            form.querySelector('#btnEnviarVal').disabled = false;
        });
        btn.addEventListener('mouseenter', () => starsDesc.innerText = DESCRIPCIONES_ESTRELLAS[parseInt(btn.getAttribute('data-valor'))] || '');
        btn.addEventListener('mouseleave', () => starsDesc.innerText = estrellaSeleccionada ? DESCRIPCIONES_ESTRELLAS[estrellaSeleccionada] : 'Selecciona una calificación');
    });

    form.querySelectorAll('.etiqueta-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const texto = chip.getAttribute('data-texto');
            const tipo  = chip.getAttribute('data-tipo');
            const idx   = etiquetasSeleccionadas.findIndex(e => e.texto === texto);
            if (idx >= 0) { etiquetasSeleccionadas.splice(idx, 1); chip.classList.remove('selected'); }
            else          { etiquetasSeleccionadas.push({ texto, tipo }); chip.classList.add('selected'); }
        });
    });

    form.querySelector('#btnEnviarVal').addEventListener('click', async () => {
        if (!estrellaSeleccionada) return alert('Selecciona una calificación.');
        const btn = form.querySelector('#btnEnviarVal');
        btn.innerText = 'Enviando...';
        btn.disabled  = true;
        try {
            const esEmpresa  = rolActual === 'Empresa';
            const comentario = form.querySelector('#comentarioVal').value.trim();
            const valuadoId  = esEmpresa ? postulacionData.programadorId : postulacionData.empresaId;

            await setDoc(doc(db, 'valoraciones', valoracionId), {
                postulacionId, proyectoId: postulacionData.proyectoId,
                autorId: usuarioActual.uid, autorRol: rolActual, valuadoId,
                estrellas: estrellaSeleccionada, etiquetas: etiquetasSeleccionadas,
                comentario, fecha: new Date().toISOString()
            });
            await actualizarReputacion(db, valuadoId, estrellaSeleccionada);
            await addDoc(collection(db, 'notificaciones'), {
                para: valuadoId,
                mensaje: `Recibiste una valoración de ${estrellaSeleccionada}/5 por el proyecto "${postulacionData.proyectoTitulo}".`,
                fecha: new Date().toISOString(), leido: false
            });
            alert('Valoración enviada correctamente.');
            window.location.reload();
        } catch (e) {
            alert('Error: ' + e.message);
            btn.innerText = 'Enviar valoración';
            btn.disabled  = false;
        }
    });

    return form;
}

// ─── ACTUALIZAR REPUTACIÓN ────────────────────────────────────────────────
async function actualizarReputacion(db, usuarioId, nuevaEstrellas) {
    try {
        const userRef  = doc(db, 'usuarios', usuarioId);
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
    } catch (e) { console.error('Error actualizando reputación:', e); }
}