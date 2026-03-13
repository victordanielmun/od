import React from 'react';
import LegalLayout from '../../layouts/LegalLayout';

const ChallengeRules = () => {
  return (
    <LegalLayout title="Reglas del Reto">
      <section>
        <h2 className="text-xl text-white font-bold mb-4">1. Elegibilidad</h2>
        <p>El reto está abierto a participantes mayores de 18 años de cualquier país de Latinoamérica.</p>
      </section>
      <section>
        <h2 className="text-xl text-white font-bold mb-4">2. Equipos</h2>
        <p>Los equipos pueden ser de 1 a 5 personas. Se permite y recomienda la formación de equipos multidisciplinarios.</p>
      </section>
      <section>
        <h2 className="text-xl text-white font-bold mb-4">3. Entrega</h2>
        <p>Todos los proyectos deben ser entregados antes de la fecha límite establecida a través de la plataforma oficial.</p>
      </section>
      <section>
        <h2 className="text-xl text-white font-bold mb-4">4. Propiedad Intelectual</h2>
        <p>Los participantes conservan todos los derechos sobre el código y los proyectos creados durante el evento.</p>
      </section>
    </LegalLayout>
  );
};

export default ChallengeRules;
