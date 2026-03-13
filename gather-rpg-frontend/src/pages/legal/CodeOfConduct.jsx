import React from 'react';
import LegalLayout from '../../layouts/LegalLayout';

const CodeOfConduct = () => {
  return (
    <LegalLayout title="Código de Conducta">
      <section>
        <h2 className="text-xl text-white font-bold mb-4">Nuestro Compromiso</h2>
        <p>Nos comprometemos a proporcionar una experiencia libre de acoso para todos, independientemente de su género, identidad de género, edad, orientación sexual, discapacidad, apariencia física, raza o religión.</p>
      </section>
      <section>
        <h2 className="text-xl text-white font-bold mb-4">Comportamiento Inaceptable</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>Comentarios ofensivos relacionados con características personales.</li>
          <li>Intimidación o acoso deliberado.</li>
          <li>Interrupción sostenida de charlas u otros eventos.</li>
          <li>Atención sexual no deseada.</li>
        </ul>
      </section>
      <section>
        <h2 className="text-xl text-white font-bold mb-4">Consecuencias</h2>
        <p>Los participantes a los que se les pida que detengan cualquier comportamiento de acoso deben cumplir de inmediato. Los organizadores pueden tomar cualquier medida que consideren apropiada, incluyendo la expulsión del evento sin reembolso.</p>
      </section>
    </LegalLayout>
  );
};

export default CodeOfConduct;
