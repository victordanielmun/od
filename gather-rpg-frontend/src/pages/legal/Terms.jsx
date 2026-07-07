import React from 'react';
import LegalLayout from '../../layouts/LegalLayout';
import { AlertTriangle, ShieldCheck, HelpCircle } from 'lucide-react';

const Terms = () => {
  return (
    <LegalLayout>
      <div className="space-y-6">
        {/* Header inside content */}
        <div className="border-b border-white/10 pb-4 mb-6">
          <h2 className="text-2xl font-extrabold tracking-wider bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent uppercase font-medieval">
            Términos y Condiciones de Uso
          </h2>
          <p className="text-gray-400 text-xs mt-1 font-mono">
            Última actualización: 6 de julio, 2026 · Versión 1.0
          </p>
        </div>

        {/* Introduction */}
        <section className="space-y-3">
          <p className="text-gray-300 text-sm leading-relaxed">
            Bienvenido a <strong>Odyssey RPG</strong> (o "Odisea"), una plataforma de aprendizaje de inglés gamificada e interactiva. Al registrarse, acceder o jugar en la plataforma, usted acepta cumplir en su totalidad con los presentes Términos de Servicio. Si no está de acuerdo con alguna disposición, debe abstenerse de usar la plataforma.
          </p>
        </section>

        {/* Age Restriction Warning Alert */}
        <section className="bg-yellow-500/10 border border-yellow-500/25 rounded-2xl p-4 flex gap-4 text-left shadow-[0_0_20px_rgba(245,158,11,0.05)]">
          <AlertTriangle className="w-8 h-8 text-yellow-500 shrink-0 mt-1" />
          <div className="text-sm font-sans leading-relaxed text-yellow-200">
            <strong className="text-yellow-400 font-bold uppercase tracking-wider block mb-1">
              Restricción de Edad — Solo Mayores de 18 Años
            </strong>
            <p className="mb-2">
              Odisea es una plataforma diseñada exclusivamente para mayores de 18 años. Al registrarse y crear una cuenta, usted declara bajo la gravedad de juramento que:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-xs text-yellow-300/90">
              <li>Tiene 18 años de edad cumplidos o más al momento del registro.</li>
              <li>La información suministrada durante el registro es veraz y verificable.</li>
              <li>Comprende que el acceso por menores de edad está estrictamente prohibido.</li>
            </ul>
            <p className="mt-2 text-xs text-yellow-400/80 italic">
              * Odyssey se reserva el derecho de suspender o eliminar de forma permanente cualquier cuenta cuyo titular no cumpla con este requisito de edad, sin previo aviso.
            </p>
          </div>
        </section>

        {/* Section 1 */}
        <section className="space-y-3">
          <h3 className="text-lg font-bold text-yellow-400 font-medieval tracking-wide flex items-center gap-2">
            <span className="text-yellow-500 font-mono">1.</span> Aceptación de los Términos
          </h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            Al registrarse en Odisea, confirma que ha leído, comprendido y acepta en su totalidad los presentes términos. Estos regulan tanto el acceso al portal web como a las integraciones multijugador, salas de chat y sistemas de aprendizaje vinculados.
          </p>
        </section>

        {/* Section 2 */}
        <section className="space-y-3">
          <h3 className="text-lg font-bold text-yellow-400 font-medieval tracking-wide flex items-center gap-2">
            <span className="text-yellow-500 font-mono">2.</span> Comunicaciones por WhatsApp
          </h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            El envío de mensajes, recordatorios y contenido motivacional a través de WhatsApp es completamente opcional y requiere autorización expresa del usuario.
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs text-gray-400 leading-relaxed">
            <li>Puede activar o desactivar las notificaciones en cualquier momento desde la configuración de su cuenta.</li>
            <li>Puede solicitar la suspensión temporal o permanente del envío de mensajes respondiendo con la palabra "STOP" en cualquier momento.</li>
            <li>Los datos de su número de teléfono no serán compartidos con terceros bajo ningún concepto.</li>
            <li>Las conversaciones son procesadas de forma segura y utilizadas únicamente para personalizar su experiencia de aprendizaje.</li>
          </ul>
        </section>

        {/* Section 3 */}
        <section className="space-y-3">
          <h3 className="text-lg font-bold text-yellow-400 font-medieval tracking-wide flex items-center gap-2">
            <span className="text-yellow-500 font-mono">3.</span> Entorno Multijugador y Responsabilidad del Usuario
          </h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            Odisea es una plataforma con componentes multijugador que permite la interacción entre usuarios registrados. Al participar en estas funciones, usted reconoce y acepta:
          </p>
          
          <div className="space-y-3 pl-4 border-l-2 border-white/10 mt-2">
            <div>
              <h4 className="text-sm font-semibold text-white">3.1 Responsabilidad de terceros</h4>
              <p className="text-gray-400 text-xs mt-1 leading-relaxed">
                Odisea no puede controlar ni garantizar el comportamiento de otros usuarios de la plataforma. Las interacciones entre jugadores son responsabilidad de cada usuario individualmente. Odisea no se hace responsable por comentarios, conductas inapropiadas o experiencias negativas derivadas de interacciones entre usuarios.
              </p>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-white">3.2 Sistema de reporte</h4>
              <p className="text-gray-400 text-xs mt-1 leading-relaxed">
                Odisea pone a disposición un sistema de reporte para denunciar conductas inapropiadas. Al reportar un jugador, el reporte será revisado por el equipo de moderación en un plazo máximo de 72 horas hábiles, y se podrán suspender temporal o permanentemente las cuentas infractoras. El usuario reportante mantendrá el anonimato frente al usuario reportado. Para reportes manuales, escriba a: <a href="mailto:support@odisea-rpg.com" className="text-yellow-400 hover:underline">support@odisea-rpg.com</a>.
              </p>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-white">3.3 Conductas prohibidas</h4>
              <ul className="list-disc pl-5 space-y-1 text-xs text-gray-400 mt-1.5">
                <li>Acoso, hostigamiento o discriminación hacia otros usuarios.</li>
                <li>Uso de lenguaje ofensivo, amenazante o inapropiado.</li>
                <li>Suplantación de identidad de otros jugadores o del equipo de desarrollo.</li>
                <li>Compartir información personal de otros usuarios sin su consentimiento explícito.</li>
                <li>Uso de scripts, automatizaciones de combate o trampas que alteren las mecánicas del juego.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 4 */}
        <section className="space-y-3">
          <h3 className="text-lg font-bold text-yellow-400 font-medieval tracking-wide flex items-center gap-2">
            <span className="text-yellow-500 font-mono">4.</span> Limitación de Responsabilidad
          </h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            El juego se proporciona "tal cual" y "según disponibilidad", sin garantías de ningún tipo. Odyssey RPG no garantiza un funcionamiento ininterrumpido, libre de errores o de pérdidas de datos causadas por problemas de conectividad o mantenimiento.
          </p>
        </section>

        {/* Section 5 */}
        <section className="space-y-3">
          <h3 className="text-lg font-bold text-yellow-400 font-medieval tracking-wide flex items-center gap-2">
            <span className="text-yellow-500 font-mono">5.</span> Modificaciones a los Términos
          </h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            Nos reservamos el derecho de actualizar estos términos en cualquier momento. Los cambios sustanciales serán notificados a través de la plataforma o vía correo electrónico. El uso continuado del servicio tras la publicación de los cambios constituye la aceptación expresa de los nuevos términos.
          </p>
        </section>
      </div>
    </LegalLayout>
  );
};

export default Terms;
