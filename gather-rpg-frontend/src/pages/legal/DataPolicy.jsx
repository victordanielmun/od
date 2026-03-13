import React from 'react';
import LegalLayout from '../../layouts/LegalLayout';

const DataPolicy = () => {
  return (
    <LegalLayout title="Política de Privacidad">
      <section>
        <h2 className="text-xl text-white font-bold mb-4">Recopilación de Datos</h2>
        <p>Recopilamos información básica necesaria para el registro y la gestión del evento, incluyendo nombre, correo electrónico y perfil profesional.</p>
      </section>
      <section>
        <h2 className="text-xl text-white font-bold mb-4">Uso de la Información</h2>
        <p>Sus datos se utilizan exclusivamente para comunicaciones relacionadas con el evento, la formación de equipos y la entrega de premios.</p>
      </section>
      <section>
        <h2 className="text-xl text-white font-bold mb-4">Compartir Datos</h2>
        <p>No vendemos ni compartimos sus datos personales con terceros no afiliados sin su consentimiento explícito.</p>
      </section>
    </LegalLayout>
  );
};

export default DataPolicy;
