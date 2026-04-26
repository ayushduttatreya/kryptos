import { useState, useEffect } from 'react';

const KONAMI_CODE = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'b',
  'a'
];

export const useKonamiCode = () => {
  const [success, setSuccess] = useState(false);
  const [sequence, setSequence] = useState([]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const key = e.key;
      
      setSequence((prev) => {
        const newSequence = [...prev, key];
        if (newSequence.length > KONAMI_CODE.length) {
          newSequence.shift();
        }

        if (newSequence.join(',') === KONAMI_CODE.join(',')) {
          setSuccess(true);
        }

        return newSequence;
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return { success, setSuccess };
};
