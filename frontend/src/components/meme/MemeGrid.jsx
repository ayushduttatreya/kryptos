import React, { useEffect, useState } from 'react';
import { fetchMemes } from '../../api/memeApi';
import MemeCard from './MemeCard';

const MemeGrid = () => {
  const [memes, setMemes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const loadMemes = async () => {
      const data = await fetchMemes(50);
      if (mounted) {
        setMemes(data);
        setLoading(false);
      }
    };
    loadMemes();
    return () => { mounted = false; };
  }, []);

  if (loading) {
    return (
      <div className="columns-1 sm:columns-2 lg:columns-3 gap-6 pt-20 px-6 pb-12 max-w-7xl mx-auto">
        {[...Array(12)].map((_, i) => (
          <div key={i} className="bg-bgTertiary border border-borderBase rounded-md overflow-hidden mb-6 break-inside-avoid">
            <div className="w-full h-64 skeleton" />
            <div className="p-4">
              <div className="h-4 skeleton w-3/4 mb-4" />
              <div className="h-8 skeleton w-1/3 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="columns-1 sm:columns-2 lg:columns-3 gap-6 pt-20 px-6 pb-12 max-w-7xl mx-auto">
      {memes.map((meme, idx) => (
        <MemeCard key={meme.postLink || idx} meme={meme} />
      ))}
    </div>
  );
};

export default MemeGrid;
