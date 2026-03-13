import { useState } from 'react';
import { Send, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Registration = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'developer'
  });
  const [submitted, setSubmitted] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    // Simulate API call
    setTimeout(() => {
      setSubmitted(true);
      // Redirect to the app's register page after a short delay
      setTimeout(() => {
        navigate('/register');
      }, 1500);
    }, 1000);
  };

  return (
    <section id="register" className="py-20 relative overflow-hidden bg-[#0a101f]">
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-neon-purple/20 rounded-full blur-[100px]"></div>
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-neon-blue/20 rounded-full blur-[100px]"></div>

      <div className="max-w-4xl mx-auto px-4 relative z-10">
        <div className="bg-slate-900/80 backdrop-blur-lg border border-white/10 rounded-2xl p-8 md:p-12 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
          
          <div className="text-center mb-10">
            <h2 className="font-pixel text-2xl md:text-3xl text-white mb-4">
              ÚNETE A LA BATALLA
            </h2>
            <p className="font-tech text-xl text-gray-400">
              Cupos limitados. Asegura tu lugar en la arena de automatización.
            </p>
          </div>

          {submitted ? (
            <div className="flex flex-col items-center justify-center py-10 animate-in fade-in zoom-in duration-500">
              <CheckCircle size={80} className="text-neon-green text-green-400 mb-6" />
              <h3 className="font-pixel text-xl text-white text-center mb-2">¡REGISTRO COMPLETADO!</h3>
              <p className="text-gray-400 text-center">Redirigiendo a la plataforma...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="font-pixel text-xs text-neon-blue block uppercase">Codename / Nombre</label>
                  <input 
                    type="text" 
                    required
                    className="w-full bg-black/50 border border-white/20 rounded p-4 text-white focus:border-neon-blue focus:ring-1 focus:ring-neon-blue outline-none transition-all font-tech text-lg placeholder-gray-600"
                    placeholder="Ej. CyberPunk_01"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="font-pixel text-xs text-neon-blue block uppercase">Correo Electrónico</label>
                  <input 
                    type="email" 
                    required
                    className="w-full bg-black/50 border border-white/20 rounded p-4 text-white focus:border-neon-blue focus:ring-1 focus:ring-neon-blue outline-none transition-all font-tech text-lg placeholder-gray-600"
                    placeholder="dev@ejemplo.com"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="font-pixel text-xs text-neon-blue block uppercase">Clase (Rol)</label>
                <select 
                  className="w-full bg-black/50 border border-white/20 rounded p-4 text-white focus:border-neon-blue focus:ring-1 focus:ring-neon-blue outline-none transition-all font-tech text-lg"
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value})}
                >
                  <option value="developer">Developer (Full Stack)</option>
                  <option value="nocode">No-Code Specialist</option>
                  <option value="designer">Prompt Engineer</option>
                  <option value="business">Business / Founder</option>
                </select>
              </div>

              <button 
                type="submit"
                className="w-full bg-neon-purple hover:bg-fuchsia-600 text-white font-pixel text-sm py-5 rounded shadow-[0_0_20px_rgba(188,19,254,0.4)] hover:shadow-[0_0_30px_rgba(188,19,254,0.6)] transition-all flex items-center justify-center gap-3 group"
              >
                CONFIRMAR ASISTENCIA
                <Send size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
              
              <p className="text-center text-gray-500 text-xs font-sans mt-4">
                * Al registrarte aceptas recibir comunicaciones sobre el evento. No spam, solo bits.
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
};

export default Registration;
