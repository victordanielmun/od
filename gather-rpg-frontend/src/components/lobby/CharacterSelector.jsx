import wsClient from '../../services/websocket';

const classes = [
  {
    id: 'warrior',
    name: 'Warrior',
    description: 'High HP and Defense. Melee attacks.',
    color: 'bg-red-600',
    stats: { hp: 150, mp: 20, atk: 20, def: 10, spd: 100 }
  },
  {
    id: 'mage',
    name: 'Mage',
    description: 'High Magic and MP. Ranged spells.',
    color: 'bg-blue-600',
    stats: { hp: 80, mp: 100, atk: 30, def: 3, spd: 90 }
  },
  {
    id: 'archer',
    name: 'Archer',
    description: 'Fast and agile. Ranged attacks.',
    color: 'bg-green-600',
    stats: { hp: 100, mp: 40, atk: 25, def: 6, spd: 120 }
  }
];

export const CharacterSelector = ({ onSelect }) => {
  const handleSelect = (classId) => {
    // Send to backend
    wsClient.send('select_character', { character_class: classId });
    if (onSelect) onSelect(classId);
  };

  return (
    <div className="p-6 bg-gray-800 rounded-lg shadow-xl border border-gray-700 max-w-4xl w-full">
      <h2 className="text-2xl font-bold text-white mb-6 text-center">Choose Your Class</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {classes.map((cls) => (
          <div 
            key={cls.id}
            className="bg-gray-700 rounded-xl overflow-hidden hover:ring-2 hover:ring-yellow-400 transition cursor-pointer group"
            onClick={() => handleSelect(cls.id)}
          >
            <div className={`h-32 ${cls.color} flex items-center justify-center`}>
              <span className="text-4xl font-bold text-white opacity-80 group-hover:scale-110 transition">
                {cls.name[0]}
              </span>
            </div>
            
            <div className="p-4">
              <h3 className="text-xl font-bold text-white mb-2">{cls.name}</h3>
              <p className="text-gray-400 text-sm mb-4 min-h-[40px]">{cls.description}</p>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-gray-300">
                  <span>HP</span>
                  <span className="font-mono">{cls.stats.hp}</span>
                </div>
                <div className="flex justify-between text-gray-300">
                  <span>MP</span>
                  <span className="font-mono">{cls.stats.mp}</span>
                </div>
                <div className="flex justify-between text-gray-300">
                  <span>ATK</span>
                  <span className="font-mono">{cls.stats.atk}</span>
                </div>
                <div className="flex justify-between text-gray-300">
                  <span>SPD</span>
                  <span className="font-mono">{cls.stats.spd}</span>
                </div>
              </div>
              
              <button className="w-full mt-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded transition">
                Select {cls.name}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
