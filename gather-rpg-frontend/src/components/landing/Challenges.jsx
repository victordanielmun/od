import { Cpu, Lock, Workflow, Linkedin } from 'lucide-react';
import { IMAGES } from './constants';

const Challenges = () => {
  const cards = [
    {
      title: "APRENDE",
      subtitle: "NO-CODE TOOLS",
      icon: <Cpu size={40} className="animate-[pulse_3s_ease-in-out_infinite]" />,
      desc: "Domina herramientas visuales para crear flujos potentes sin escribir una sola línea de código complejo.",
      color: "border-neon-blue text-neon-blue",
      gradient: "from-neon-blue/20 to-transparent"
    },
    {
      title: "IMPLEMENTA",
      subtitle: "SEGURIDAD AGENTICA",
      icon: <Lock size={40} className="animate-[pulse_4s_ease-in-out_infinite]" />,
      desc: "Asegura tus agentes de IA. Aprende a proteger prompts, datos sensibles y evitar alucinaciones peligrosas.",
      color: "border-neon-purple text-neon-purple",
      gradient: "from-neon-purple/20 to-transparent"
    },
    {
      title: "MEJORA",
      subtitle: "TUS FLUJOS",
      icon: <Workflow size={40} className="animate-[pulse_3.5s_ease-in-out_infinite]" />,
      desc: "Optimiza la latencia y el coste de tus automatizaciones. Haz que tus bots trabajen más rápido y barato.",
      color: "border-neon-pink text-neon-pink",
      gradient: "from-neon-pink/20 to-transparent"
    }
  ];

  const mentors = [
    {
        name: "VICTOR DANIEL MUÑOZ",
        role: "INGENIERO DE SISTEMAS",
        bio: "Ingeniero de sistemas con experiencia en desarrollo web y arquitectura de software.",
        image: IMAGES.mentorVictor,
        borderColor: "border-neon-blue",
        shadowColor: "group-hover:shadow-[0_0_30px_rgba(0,243,255,0.4)]",
        socials: {
            linkedin: "https://www.linkedin.com/in/victordanielmun/"
        }
    },
    {
        name: "KEVIN GONZALEZ",
        role: "INGENIERO DE SISTEMAS",
        bio: "Ingeniero de sistemas enfocado en soluciones tecnológicas y desarrollo backend.",
        image: IMAGES.mentorKevin,
        borderColor: "border-neon-purple",
        shadowColor: "group-hover:shadow-[0_0_30px_rgba(188,19,254,0.4)]",
        socials: {
            linkedin: "https://www.linkedin.com/in/kevin-gonzalez-betancourt-649a50173/"
        }
    },
    {
        name: "MAURICIO JAVIER BARRETO",
        role: "ADMINISTRADOR DE EMPRESAS",
        bio: "Administrador de empresas con visión estratégica en proyectos de tecnología.",
        image: IMAGES.mentorMauricio,
        borderColor: "border-neon-pink",
        shadowColor: "group-hover:shadow-[0_0_30px_rgba(255,0,255,0.4)]",
        socials: {
            linkedin: "https://www.linkedin.com/in/mauricio-javier-barreto-padilla-a482aa254/"
        }
    },
    {
        name: "DARLY DAISURY CHAVEZ",
        role: "INGENIERO DE SISTEMAS",
        bio: "Ingeniera de sistemas apasionada por la innovación y el desarrollo ágil.",
        image: IMAGES.mentorDarly,
        borderColor: "border-neon-yellow",
        shadowColor: "group-hover:shadow-[0_0_30px_rgba(252,238,10,0.4)]",
        socials: {
            linkedin: "https://www.linkedin.com/in/darly-chavez-2377071b4/"
        }
    },
    {
        name: "JAMES ALEXIS HENAO",
        role: "INGENIERO DE SISTEMAS",
        bio: "Ingeniero de sistemas especializado en integración de sistemas y transformación digital.",
        image: IMAGES.mentorJames,
        borderColor: "border-neon-blue",
        shadowColor: "group-hover:shadow-[0_0_30px_rgba(0,243,255,0.4)]",
        socials: {
            linkedin: "https://www.linkedin.com/in/james-alexis-henao-serna-02384a393/"
        }
    }
  ];

  return (
    <>
      <section id="challenges" className="py-20 bg-neon-dark relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="font-pixel text-2xl md:text-4xl text-white mb-4">
              CHALLENGE PILLARS
            </h2>
            <div className="h-1 w-24 bg-neon-purple mx-auto"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {cards.map((card, idx) => (
              <div 
                key={idx}
                className={`relative group bg-slate-900 border-2 ${card.color} p-6 rounded-lg transition-transform hover:-translate-y-2 duration-300`}
              >
                {/* Internal Glow */}
                <div className={`absolute inset-0 bg-gradient-to-b ${card.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}></div>
                
                <div className="relative z-10 flex flex-col h-full">
                  <div className={`mb-6 p-4 rounded-full bg-white/5 w-fit ${card.color}`}>
                    {card.icon}
                  </div>
                  
                  <h3 className="font-tech font-bold text-3xl text-white mb-1">
                    {card.title}
                  </h3>
                  <h4 className={`font-pixel text-xs ${card.color} mb-4`}>
                    {card.subtitle}
                  </h4>
                  
                  <p className="font-sans text-gray-400 leading-relaxed">
                    {card.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Speakers Section */}
      <section id="speakers" className="py-20 bg-black relative border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
           <div className="text-center mb-16">
            <h2 className="font-pixel text-2xl md:text-4xl text-white mb-4">
              MENTORES
            </h2>
            <p className="font-tech text-xl text-neon-blue uppercase tracking-widest">
                Expertos guiando tu camino
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
            {mentors.map((mentor, idx) => (
                <div key={idx} className="group relative">
                    <div className={`absolute -inset-0.5 bg-gradient-to-r from-neon-blue to-neon-purple opacity-50 blur group-hover:opacity-100 transition duration-500`}></div>
                    <div className="relative bg-neon-dark p-4 h-full border border-white/10 flex flex-col items-center text-center">
                        <div className={`w-24 h-24 rounded-full border-2 ${mentor.borderColor} p-1 mb-4 ${mentor.shadowColor} transition-all duration-300`}>
                            <img src={mentor.image} alt={mentor.name} className="w-full h-full rounded-full object-cover filter grayscale group-hover:grayscale-0 transition-all duration-500" />
                        </div>
                        
                        <h3 className="font-pixel text-xs text-white mb-1 leading-tight min-h-[2.5em] flex items-center justify-center">{mentor.name}</h3>
                        <p className={`font-tech text-xs font-bold mb-2 ${mentor.borderColor.replace('border-', 'text-')}`}>{mentor.role}</p>
                        
                        <p className="font-sans text-gray-500 text-[10px] mb-4 flex-grow line-clamp-3">
                            {mentor.bio}
                        </p>

                        <div className="flex gap-2">
                            {mentor.socials.linkedin && (
                                <a href={mentor.socials.linkedin} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
                                    <Linkedin size={16} />
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
};

export default Challenges;
