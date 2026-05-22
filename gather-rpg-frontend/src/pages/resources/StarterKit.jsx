import React from 'react';
import LegalLayout from '../../layouts/LegalLayout';

const StarterKit = () => {
  return (
    <LegalLayout title="Kit de Inicio">
      <section>
        <h2 className="text-xl text-white font-bold mb-4">Bienvenido al Reto</h2>
        <p>Este kit contiene todos los recursos necesarios para comenzar tu viaje en Odisea AI Challenge.</p>
      </section>
      <section>
        <h2 className="text-xl text-white font-bold mb-4">Recursos Disponibles</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>Acceso a APIs exclusivas de nuestros patrocinadores.</li>
          <li>Créditos en la nube para despliegue de prototipos.</li>
          <li>Plantillas de código para agentes de IA y flujos de automatización.</li>
          <li>Acceso al canal privado de Discord para soporte técnico.</li>
        </ul>
      </section>
      <section>
        <h2 className="text-xl text-white font-bold mb-4">Descargas</h2>
        <a href="#" className="text-neon-blue hover:underline">Descargar Pack de Assets (ZIP)</a>
      </section>
    </LegalLayout>
  );
};

export default StarterKit;
