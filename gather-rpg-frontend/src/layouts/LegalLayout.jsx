import React from 'react';
import Navbar from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';

const LegalLayout = ({ title, children }) => {
  return (
    <div className="bg-neon-dark min-h-screen text-white selection:bg-neon-purple selection:text-white flex flex-col">
      <Navbar />
      <main className="flex-grow pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full">
        <h1 className="font-pixel text-3xl md:text-4xl text-neon-blue mb-8 border-b border-white/10 pb-4">
          {title}
        </h1>
        <div className="font-sans text-gray-300 space-y-6 leading-relaxed">
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default LegalLayout;
