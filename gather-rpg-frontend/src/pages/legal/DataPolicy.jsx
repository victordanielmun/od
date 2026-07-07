import React from 'react';
import LegalLayout from '../../layouts/LegalLayout';
import { ShieldCheck, ShieldAlert, Cpu } from 'lucide-react';

const DataPolicy = () => {
  return (
    <LegalLayout>
      <div className="space-y-6">
        {/* Header inside content */}
        <div className="border-b border-white/10 pb-4 mb-6">
          <h2 className="text-2xl font-extrabold tracking-wider bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent uppercase font-medieval">
            Política de Privacidad y Protección de Datos
          </h2>
          <p className="text-gray-400 text-xs mt-1 font-mono">
            Última actualización: 6 de julio, 2026 · Versión 1.0
          </p>
        </div>

        {/* Introduction & Legal Framework */}
        <section className="space-y-3">
          <p className="text-gray-300 text-sm leading-relaxed">
            En <strong>Odyssey RPG</strong> ("Odisea"), nos comprometemos profundamente con la privacidad y transparencia de sus datos personales. Esta Política de Privacidad describe cómo recopilamos, almacenamos y procesamos su información en cumplimiento estricto de la <strong>Ley Estatutaria 1581 de 2012</strong> (Colombia), el <strong>Decreto Reglamentario 1377 de 2013</strong> (Habeas Data) y demás normas concordantes.
          </p>
        </section>

        {/* Key Highlight - Security Pledge */}
        <section className="bg-emerald-950/20 border border-emerald-500/20 rounded-2xl p-4 flex gap-4 text-left shadow-[0_0_20px_rgba(16,185,129,0.03)]">
          <ShieldCheck className="w-8 h-8 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-sm font-sans leading-relaxed text-emerald-200">
            <strong className="text-emerald-400 font-bold uppercase tracking-wider block mb-1">
              Compromiso de Privacidad
            </strong>
            <p className="text-xs text-gray-300">
              Tus datos son tuyos. En Odyssey, no vendemos, alquilamos ni compartimos tus datos personales con terceros para fines comerciales. Solo recopilamos lo estrictamente necesario para garantizar una experiencia interactiva y de aprendizaje de alta calidad.
            </p>
          </div>
        </section>

        {/* Section 1 */}
        <section className="space-y-3">
          <h3 className="text-lg font-bold text-yellow-400 font-medieval tracking-wide flex items-center gap-2">
            <span className="text-yellow-500 font-mono">1.</span> Datos que Recopilamos
          </h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            Recopilamos la información mínima necesaria para el correcto funcionamiento del juego, incluyendo:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs text-gray-400 leading-relaxed">
            <li><strong>Información de Registro:</strong> Nombre, apellidos y dirección de correo electrónico.</li>
            <li><strong>Número de WhatsApp:</strong> Únicamente si decide vincular voluntariamente las notificaciones y tutoría del bot del juego.</li>
            <li><strong>Progreso en la Plataforma:</strong> Puntuaciones, streaks diarios, nivel de inglés, vocabulario aprendido y estadísticas de juego.</li>
            <li><strong>Grabaciones de Voz:</strong> Archivos de audio temporales generados al utilizar la herramienta de reconocimiento de pronunciación.</li>
          </ul>
        </section>

        {/* Section 2 - Reddit and API Integration */}
        <section className="space-y-3">
          <h3 className="text-lg font-bold text-yellow-400 font-medieval tracking-wide flex items-center gap-2">
            <span className="text-yellow-500 font-mono">2.</span> Integración con Reddit y Procesamiento Técnico
          </h3>
          <div className="bg-black/30 border border-white/5 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-yellow-400/90 font-bold text-xs uppercase tracking-wide">
              <Cpu className="w-4 h-4 text-yellow-500" />
              <span>Detalles del Ecosistema de Reddit</span>
            </div>
            <p className="text-gray-400 text-xs leading-relaxed">
              Odyssey RPG está integrado con la plataforma de desarrollo de Reddit. Cuando accede a través de ella:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-[11px] text-gray-500 leading-relaxed">
              <li>Procesamos de forma segura su Reddit Username e ID de usuario para crear y sincronizar su perfil de personaje y logros.</li>
              <li>La base de datos se almacena en el almacenamiento Redis aislado y seguro de Reddit asignado a nuestra aplicación.</li>
              <li><strong>Conexión con OpenAI API:</strong> Para la generación inteligente de misiones y diálogos interactivos de traducción, enviamos solicitudes seguras a la API de OpenAI. Estas solicitudes contienen únicamente contexto temático de juego y <strong>nunca transmiten información personal identificable (PII)</strong> del usuario.</li>
            </ul>
          </div>
        </section>

        {/* Section 3 */}
        <section className="space-y-3">
          <h3 className="text-lg font-bold text-yellow-400 font-medieval tracking-wide flex items-center gap-2">
            <span className="text-yellow-500 font-mono">3.</span> Finalidad del Tratamiento de Datos
          </h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            Los datos recopilados se utilizarán exclusivamente para:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs text-gray-400 leading-relaxed">
            <li>Personalizar y optimizar la experiencia de aprendizaje y gamificación dentro de Odisea.</li>
            <li>Gestionar el sistema multijugador, la visibilidad de nombres de usuario en tableros de líderes y salas comunes.</li>
            <li>Enviar recordatorios, vocabulario del día y alertas de streak a través del bot de WhatsApp (solo si está expresamente autorizado por usted).</li>
            <li>Monitorear y evitar conductas fraudulentas, trampas, o acoso que atenten contra la seguridad de la comunidad.</li>
          </ul>
        </section>

        {/* Section 4 */}
        <section className="space-y-3">
          <h3 className="text-lg font-bold text-yellow-400 font-medieval tracking-wide flex items-center gap-2">
            <span className="text-yellow-500 font-mono">4.</span> Compartición de Datos
          </h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            Sus datos personales no serán vendidos, alquilados ni transferidos a terceros. Únicamente se podrán compartir datos en circunstancias excepcionales:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs text-gray-400 leading-relaxed">
            <li>Bajo requerimientos judiciales explícitos de autoridades competentes colombianas.</li>
            <li>Con proveedores de infraestructura técnica (alojamiento en la nube) vinculados contractualmente a estrictos acuerdos de confidencialidad y procesamiento seguro de datos.</li>
          </ul>
        </section>

        {/* Section 5 */}
        <section className="space-y-3">
          <h3 className="text-lg font-bold text-yellow-400 font-medieval tracking-wide flex items-center gap-2">
            <span className="text-yellow-500 font-mono">5.</span> Derechos del Usuario (Habeas Data)
          </h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            En cumplimiento del artículo 8 de la Ley 1581 de 2012, usted cuenta con los derechos de:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs text-gray-400 leading-relaxed">
            <li>Conocer, actualizar y rectificar sus datos personales frente a Odyssey en cualquier momento.</li>
            <li>Solicitar la supresión de sus datos de nuestros servidores cuando decida dar de baja su cuenta.</li>
            <li>Revocar la autorización de notificaciones o de envío de mensajes de WhatsApp.</li>
            <li>Presentar quejas por infracciones a la ley ante la Superintendencia de Industria y Comercio (SIC).</li>
          </ul>
          <p className="text-gray-300 text-xs mt-3 leading-relaxed">
            Para ejercer cualquiera de estos derechos, o solicitar la eliminación total de sus datos, por favor contáctenos directamente a nuestro correo oficial de privacidad: <a href="mailto:privacidad@odiseagame.co" className="text-yellow-400 hover:underline">privacidad@odiseagame.co</a>.
          </p>
        </section>
      </div>
    </LegalLayout>
  );
};

export default DataPolicy;
