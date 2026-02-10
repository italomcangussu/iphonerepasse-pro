import React from 'react';

interface BatterySliderProps {
  value: number;
  onChange: (value: number) => void;
}

const BatterySlider: React.FC<BatterySliderProps> = ({ value, onChange }) => {
  const getColor = (val: number) => {
    if (val <= 79) return '#ef4444'; // Red
    if (val <= 89) return '#eab308'; // Yellow
    return '#22c55e'; // Green
  };

  return (
    <div className="w-full">
      <div className="flex justify-between mb-2">
        <label className="text-sm font-medium text-slate-300">Saúde da Bateria</label>
        <span 
          className="text-sm font-bold px-2 py-0.5 rounded"
          style={{ backgroundColor: `${getColor(value)}20`, color: getColor(value) }}
        >
          {value}%
        </span>
      </div>
      <div className="relative h-6 w-full rounded-full bg-dark-700 border border-dark-600 overflow-hidden cursor-pointer group">
        <input
          type="range"
          min="0"
          max="100"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />
        <div 
          className="h-full transition-all duration-300"
          style={{ 
            width: `${value}%`, 
            backgroundColor: getColor(value),
            background: `linear-gradient(90deg, #ef4444 0%, #eab308 80%, #22c55e 100%)`
          }}
        />
        <div 
          className="absolute top-0 bottom-0 w-1 bg-white shadow-lg transform -translate-x-1/2 pointer-events-none transition-all group-hover:scale-110"
          style={{ left: `${value}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-slate-500 mt-1">
        <span>Manutenção</span>
        <span>Ideal</span>
      </div>
    </div>
  );
};

export default BatterySlider;