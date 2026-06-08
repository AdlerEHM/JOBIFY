// ─── CONFIGURACIÓN EMAILJS ────────────────────────────────────────────────
// Importar EmailJS desde CDN en cada HTML que lo use:
// <script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js"></script>
// <script>emailjs.init("bvCwb6Qdnk4UEZ3Gk");</script>

const EMAILJS_SERVICE_ID    = "service_sq5han5";
const EMAILJS_TEMPLATE_POST = "template_xxcagun"; // Postulaciones
const EMAILJS_TEMPLATE_PROY = "template_kdb93sl"; // Proyectos

// ─── FUNCIÓN BASE ─────────────────────────────────────────────────────────
async function enviarCorreo(templateId, nombre, email, asunto, mensaje) {
    if (!email || !nombre) return; // No enviar si no hay datos
    try {
        await emailjs.send(EMAILJS_SERVICE_ID, templateId, {
            nombre,
            to_email: email,
            asunto,
            mensaje
        });
        console.log(`✅ Correo enviado a ${email}: ${asunto}`);
    } catch (e) {
        console.error("❌ Error enviando correo:", e);
    }
}

// ─── TEMPLATE 1: POSTULACIONES ────────────────────────────────────────────

// Empresa recibe cuando un programador se postula
export async function notificarNuevaPostulacion(empresaEmail, empresaNombre, programadorNombre, proyectoTitulo) {
    await enviarCorreo(
        EMAILJS_TEMPLATE_POST,
        empresaNombre,
        empresaEmail,
        `Nueva postulación en "${proyectoTitulo}"`,
        `El programador ${programadorNombre} se postuló a tu proyecto "${proyectoTitulo}". Ingresa a Jobify para revisar su propuesta y decidir si lo aceptas.`
    );
}

// Programador recibe cuando es aceptado
export async function notificarPostulacionAceptada(programadorEmail, programadorNombre, empresaNombre, proyectoTitulo) {
    await enviarCorreo(
        EMAILJS_TEMPLATE_POST,
        programadorNombre,
        programadorEmail,
        `¡Fuiste aceptado en "${proyectoTitulo}"!`,
        `¡Felicidades! La empresa ${empresaNombre} aceptó tu postulación para el proyecto "${proyectoTitulo}". Ingresa a Jobify para firmar el contrato e iniciar el proyecto.`
    );
}

// Programador recibe cuando es rechazado
export async function notificarPostulacionRechazada(programadorEmail, programadorNombre, empresaNombre, proyectoTitulo) {
    await enviarCorreo(
        EMAILJS_TEMPLATE_POST,
        programadorNombre,
        programadorEmail,
        `Actualización sobre tu postulación en "${proyectoTitulo}"`,
        `La empresa ${empresaNombre} revisó tu postulación para "${proyectoTitulo}" y en esta ocasión seleccionó otro candidato. ¡No te desanimes! Sigue explorando proyectos en Jobify.`
    );
}

// ─── TEMPLATE 2: PROYECTOS ────────────────────────────────────────────────

// Ambos reciben cuando el proyecto se completa
export async function notificarProyectoCompletado(email, nombre, proyectoTitulo) {
    await enviarCorreo(
        EMAILJS_TEMPLATE_PROY,
        nombre,
        email,
        `El proyecto "${proyectoTitulo}" ha sido completado`,
        `El proyecto "${proyectoTitulo}" ha sido completado por ambas partes. Ingresa a Jobify para dejar tu valoración. Tu opinión es muy importante para la comunidad.`
    );
}

// Ambos reciben cuando el otro valora
export async function notificarValoracionRecibida(email, nombre, proyectoTitulo, estrellas) {
    await enviarCorreo(
        EMAILJS_TEMPLATE_PROY,
        nombre,
        email,
        `Recibiste una valoración de ${estrellas} ⭐ en "${proyectoTitulo}"`,
        `Alguien dejó una valoración de ${estrellas} estrellas sobre tu desempeño en el proyecto "${proyectoTitulo}". Ingresa a Jobify para verla.`
    );
}

// Programador recibe cuando la empresa firma el contrato
export async function notificarContratoFirmado(email, nombre, otroNombre, proyectoTitulo, rolOtro) {
    await enviarCorreo(
        EMAILJS_TEMPLATE_PROY,
        nombre,
        email,
        `${rolOtro} firmó el contrato de "${proyectoTitulo}"`,
        `${otroNombre} firmó el contrato del proyecto "${proyectoTitulo}". Ingresa a Jobify para firmar tú también y habilitar el workspace.`
    );
}