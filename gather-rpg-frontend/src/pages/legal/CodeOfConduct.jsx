import React from 'react';
import LegalLayout from '../../layouts/LegalLayout';
import { UserCheck, ShieldAlert, Heart } from 'lucide-react';

const CodeOfConduct = () => {
  return (
    <LegalLayout>
      <div className="space-y-6">
        {/* Header inside content */}
        <div className="border-b border-white/10 pb-4 mb-6">
          <h2 className="text-2xl font-extrabold tracking-wider bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent uppercase font-medieval">
            Código de Conducta de la Comunidad
          </h2>
          <p className="text-gray-400 text-xs mt-1 font-mono">
            Última actualización: 6 de julio, 2026 · Versión 1.0
          </p>
        </div>

        {/* Commitment */}
        <section className="space-y-3">
          <p className="text-gray-300 text-sm leading-relaxed">
            En <strong>Odyssey RPG</strong>, nos esforzamos por crear un espacio inclusivo, amigable y respetuoso para todos los aventureros. Nuestro objetivo es que todos los jugadores puedan aprender inglés, divertirse y cooperar sin temor a ser discriminados o acosados.
          </p>
        </section>

        {/* Highlight Card - Respect */}
        <section className="bg-amber-500/5 border border-yellow-500/15 rounded-2xl p-4 flex gap-4 text-left shadow-[0_0_20px_rgba(245,158,11,0.03)]">
          <Heart className="w-8 h-8 text-yellow-500 shrink-0 mt-0.5" />
          <div className="text-sm font-sans leading-relaxed text-yellow-200">
            <strong className="text-yellow-400 font-bold uppercase tracking-wider block mb-1">
              Nuestro Compromiso
            </strong>
            <p className="text-xs text-gray-300">
              Nos comprometemos a proporcionar una experiencia libre de acoso para todos, independientemente de su género, orientación sexual, identidad, capacidades físicas o cognitivas, edad, apariencia física, nacionalidad, raza o religión.
            </p>
          </div>
        </section>

        {/* Section 1 - Unacceptable Behavior */}
        <section className="space-y-3">
          <h3 className="text-lg font-bold text-yellow-400 font-medieval tracking-wide flex items-center gap-2">
            <span className="text-yellow-500 font-mono">1.</span> Comportamientos Inaceptables
          </h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            Se considera comportamiento inaceptable cualquier conducta que afecte negativamente la experiencia o seguridad de los usuarios de Odyssey RPG. Esto incluye:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-xs text-gray-400 leading-relaxed">
            <li><strong>Acoso y Hostigamiento:</strong> Comentarios ofensivos, despectivos o intimidantes relacionados con la identidad de género, raza, religión, discapacidad u orientación de un usuario.</li>
            <li><strong>Lenguaje Inapropiado:</strong> Uso reiterado de lenguaje vulgar, insultos o insinuaciones de carácter sexual no deseadas en las tabernas multijugador o chats grupales.</li>
            <li><strong>Suplantación de Identidad:</strong> Pretender ser otro jugador, administrador, o moderador oficial de Odyssey.</li>
            <li><strong>Violación de la Privacidad:</strong> Publicar o amenazar con publicar información personal identificable de otros usuarios (Doxxing) sin su consentimiento previo.</li>
            <li><strong>Comportamiento Disruptivo:</strong> Interrupción intencional del chat, spam masivo, envío de enlaces maliciosos, o el uso de trampas que afecten la equidad de las mecánicas de juego.</li>
          </ul>
        </section>

        {/* Section 2 - Moderation & Consequences */}
        <section className="space-y-3">
          <h3 className="text-lg font-bold text-yellow-400 font-medieval tracking-wide flex items-center gap-2">
            <span className="text-yellow-500 font-mono">2.</span> Consecuencias y Moderación
          </h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            El incumplimiento de este Código de Conducta no será tolerado y acarreará consecuencias inmediatas de acuerdo con la gravedad de la falta:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs text-gray-400 leading-relaxed">
            <li><strong>Advertencia Formal:</strong> Para incidentes menores de convivencia, se emitirá una alerta directa al usuario.</li>
            <li><strong>Silencio Temporal (Mute):</strong> Suspensión de la capacidad del usuario para enviar mensajes en los chats multijugador durante un período determinado.</li>
            <li><strong>Suspensión Permanente de la Cuenta:</strong> Bloqueo inmediato y definitivo de las credenciales de acceso para conductas graves como el acoso continuado, trampas automatizadas o suplantación de identidad.</li>
          </ul>
        </section>

        {/* Section 3 - Reporting System */}
        <section className="space-y-3">
          <h3 className="text-lg font-bold text-yellow-400 font-medieval tracking-wide flex items-center gap-2">
            <span className="text-yellow-500 font-mono">3.</span> Cómo Reportar un Incidente
          </h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            Si experimenta o es testigo de un comportamiento inaceptable, le instamos a utilizar nuestras herramientas de protección:
          </p>
          <div className="bg-black/30 border border-white/5 rounded-xl p-4 space-y-2 text-xs text-gray-400 leading-relaxed">
            <p>
              1. <strong>En el Juego:</strong> Acceda al perfil del jugador infractor y seleccione el botón de <strong>"Reportar"</strong>. Esto enviará una captura de chat directamente al equipo de moderación.
            </p>
            <p>
              2. <strong>Por Correo Electrónico:</strong> Escríbanos detallando el incidente, hora aproximada y capturas de pantalla a: <a href="mailto:support@odisea-rpg.com" className="text-yellow-400 hover:underline">support@odisea-rpg.com</a>.
            </p>
            <p className="text-yellow-500/80 italic mt-2">
              * Nota: Todos los reportes son manejados con estricta confidencialidad y el reportante mantendrá el anonimato total.
            </p>
          </div>
        </section>
      </div>
    </LegalLayout>
  );
};

export default CodeOfConduct;
