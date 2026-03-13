import React from 'react';
import LegalLayout from '../../layouts/LegalLayout';

const Terms = () => {
  return (
    <LegalLayout title="Términos y Condiciones">
      <section>
        <h2 className="text-xl text-white font-bold mb-4">Aceptación de los Términos</h2>
        <p>Al registrarse en Battle Night AI Challenge, usted acepta cumplir con estos términos y condiciones.</p>
      </section>
      <section>
        <h2 className="text-xl text-white font-bold mb-4">Conducta del Participante</h2>
        <p>Se espera que todos los participantes actúen de manera profesional y respetuosa. Cualquier forma de acoso o comportamiento disruptivo resultará en la descalificación inmediata.</p>
      </section>
      <section>
        <h2 className="text-xl text-white font-bold mb-4">Cambios en el Evento</h2>
        <p>Los organizadores se reservan el derecho de modificar las fechas, horarios o reglas del evento si fuera necesario por causas de fuerza mayor.</p>
      </section>
    </LegalLayout>
  );
};

export default Terms;
